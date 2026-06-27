# ADO Pipelines API Reference
_Used by app-readiness skill to query pipeline state_

## Base URL

```
https://dev.azure.com/{org}/{project}/_apis
```

Organisation and project are read from CLAUDE.md or `.claude/architecture/architecture-deployment.md`.

## Authentication

Build the auth header once before making any calls. **Always use `--ssl-no-revoke -4`** on
the Kirkland network — see `../../../tools/ado-helper/README.md` for why both flags are required.

```bash
ADO_AUTH=$(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w 0)
unset AZURE_DEVOPS_PAT   # scrub raw PAT immediately
```

Use `-H "Authorization: Basic $ADO_AUTH"` on every call below. Never use `-u ":$AZURE_DEVOPS_PAT"` — that embeds the raw PAT in the command and shell history.

---

## List pipelines

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/pipelines?api-version=7.1" \
| node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  (d.value||[]).forEach(p=>console.log('ID='+p.id+' NAME='+p.name+' FOLDER='+(p.folder||'/')));
});"
```

---

## Get last run of a pipeline

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/pipelines/{pipelineId}/runs?api-version=7.1&\$top=1" \
| node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  const runs=d.value||[];
  if(runs.length){ const r=runs[0]; console.log('STATE='+r.state+' RESULT='+(r.result||'in-progress')+' FINISHED='+(r.finishedDate||'')); }
  else console.log('NO_RUNS');
});"
```

---

## Get pipeline YAML definition (detect stages and approvals)

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/build/definitions/{definitionId}?api-version=7.1" \
| node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  console.log('PROCESS_TYPE:', (d.process||{}).type||'unknown');
  console.log('QUEUE_ON_SOURCE_UPDATE:', (d.triggers||[{}])[0].triggerType||'unknown');
});"
```

---

## List environments (for approval gates)

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/distributedtask/environments?api-version=7.1" \
| node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  (d.value||[]).forEach(e=>console.log('ENV='+e.name+' ID='+e.id));
});"
```

---

## Check approvals on an environment

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/pipelines/approvals?api-version=7.1-preview" \
| node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  (d.value||[]).forEach(a=>console.log('APPROVAL_ID='+a.id+' STATUS='+a.status+' ENV='+((a.pipeline||{}).name||'?')));
});"
```

---

## List recent builds (last 10)

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/build/builds?\$top=10&api-version=7.1" \
| node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  (d.value||[]).forEach(b=>console.log('BUILD='+b.buildNumber+' STATUS='+b.status+' RESULT='+(b.result||'in-progress')+' BRANCH='+b.sourceBranch+' FINISHED='+(b.finishTime||'')));
});"
```

---

## Check for service connections (required for deployments)

```bash
curl -s --ssl-no-revoke -4 -H "Authorization: Basic $ADO_AUTH" \
  "https://dev.azure.com/{org}/{project}/_apis/serviceendpoint/endpoints?api-version=7.1" \
| node -e "
const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  (d.value||[]).forEach(e=>console.log('SC='+e.name+' TYPE='+e.type+' READY='+e.isReady));
});"
```

---

## Required PAT scopes for app-readiness

| Scope | Permission | Used for |
|---|---|---|
| Build | Read | List pipelines, last run results |
| Release | Read | List release definitions, environments |
| Environment | Read & Manage | Check approval gates |
| Service Connections | Read | Verify deployment connections exist |
| Code | Read | Check branch policies, PR status |

Generate a PAT at: `https://dev.azure.com/{org}/_usersSettings/tokens`
