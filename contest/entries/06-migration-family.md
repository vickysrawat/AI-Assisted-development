# Entry 6 — Legacy Migration Family (Upgrade · Rewrite · Replatform)

> The one where modernizing legacy code stops being a cowboy job: three honest, gated, resumable
> skills instead of one heroic all-nighter.
> Category: Working solution · Status: READY
> Numbers pulled from `../measured-claims.md` §4 and labeled honestly; demo in `../demo-scripts.md` §Entry 6.

---

## 1. The pitch, in one breath

"Migrate this legacy app" is really three different jobs wearing one name: a version bump, a
rewrite, and a hosting move, each with its own risks. This gives you three focused skills, one per
job, each of which you can stop and resume, and none of which will pretend a rewrite is an upgrade.

## 2. Why it exists

Everyone who's done a legacy migration knows how it goes wrong. Someone sells a full rewrite as a
"quick upgrade." A cutover happens at midnight with no runbook. The session dies halfway through and
there's no way to pick up where it stopped. And when you turn a hungry AI loose on the whole thing, it
produces target code that *looks* right and is subtly, expensively wrong.

The root cause is that one word, "migrate," hides three jobs that deserve to be handled differently.
Conflate them and you get the cowboy migration. So this deliberately splits them apart, on the honest
axis of *what's actually changing*. It's for teams modernizing something real, who want the work scoped
truthfully, gated, verified, and (crucially) resumable when life interrupts.

## 3. What actually works today

Three skills, and you pick the one that fits:

- **`UPGRADE`:** same stack, higher version, in place. It plans and drives an *external* deterministic
  tool (the plugin emits the ordered steps; the stack-native tool does the transform), hands you a
  gap-and-risk report, and here's the honest bit: it **refuses false upgrades**. If the change is
  really a rewrite in disguise, it says so and routes you to Rewrite.
- **`REWRITE`:** a different stack entirely, generated into a new target folder. It figures out how
  much re-architecture the jump demands, offers you target options, breaks the work along a dependency
  graph, and schedules the clusters into isolated git worktrees, building one cluster at a time behind
  quality gates.
- **`REPLATFORM`:** moving the hosting (on-prem to cloud). The AI writes the infrastructure-as-code
  and a runbook a human can follow; **a human runs the actual cutover.**

Each one remembers where it was: `… RESUME` picks up from a ledger, `… STATUS` tells you exactly what's
next.

## 4. Who does what (and the AI's role changes per job)

- On **Upgrade**, the AI is an *orchestrator*: it plans the steps and drives an external deterministic
  tool, and it doesn't freestyle the transform.
- On **Rewrite**, the AI is a *generative author*, but heavily gated (more below).
- On **Replatform**, the AI is an *author too*, of IaC and runbooks, but never the executor of the
  production cutover. That's a human's finger on the button.
- **You** choose which skill (nothing auto-routes, and a wrong guess here is expensive), and approve
  every gate. Facts come web-grounded and labeled `VERIFIED`; the offline knowledge is clearly the
  lesser, `INFERRED` fallback.

## 5. How a rewrite actually moves (the hardest case)

1. It reads how far the jump really is, and presents target options (assurance vs effort vs cost)
   for **you to choose** (or brings your own design, held to the same bar).
2. It decomposes the work along a dependency graph in the *target's* terms, and **each option gets its
   own DAG**. There's no target app yet at options time, so it projects the source graph through *that
   option's* posture: a like-for-like port stays close to the source seams; a re-architecture merges,
   splits, and re-layers. The shape genuinely differs per option (labeled `INFERRED` until the design is
   approved, then re-derived as `computed`), and that per-option difference is *tested*, not asserted.
3. It schedules the clusters into isolated **git worktrees** (so parallel work is designed not to
   collide), generating one cluster at a time, each carrying a behavioral-assurance level and an
   enterprise-readiness level, behind a merge gate and a completion gate. **You approve each gate.**

## 6. What it's worth (told straight, labeled straight)

The things you can lean on today: every stage is **resumable** from a ledger; every rewrite cluster
carries a **verification level** you can point to; the rewrite's **target-space decomposition genuinely
differs per option** (a mechanical, unit-tested property, not the same source graph relabelled);
Upgrade drives a **deterministic** tool rather than guesswork; and it **refuses to mislabel** a rewrite
as an upgrade. *(measured: the ledger, the handlers, the per-option DAG test, and the gate design all
exist; `../measured-claims.md` §4.)*

What I won't dress up: I don't have a **migration success rate on a real production app**, so that's
**not-yet-evaluated**. And the supported source/target combos are a subset of the full stack list.
Replatform's **NFR-assurance oracle** now runs end-to-end: the "prove-done" step grades each NFR with a
**tested** deterministic engine (weakest-link, measurability-ceilinged; a regulated NFR below floor is a
hard block), assembles a Well-Architected posture from the app-readiness output, and adds a golden-master
smoke. But it necessarily executes *after* a human-run cutover, so I have no numbers from a real move
yet. And worktree isolation and `RESUME` are enforced by skill instruction over a persisted, merge-write
ledger: the ledger and gate design are deterministic, but the *replay* on resume is LLM-driven
re-orientation, not a mechanical replay engine.

## 7. Why it sticks with you

The demo beat worth showing: kill the session mid-migration, just close it, then reopen, type
`… RESUME`, and watch it continue from the last recorded gate in the ledger. Migrations are exactly
where things break and sessions die, so treating *resume* as a first-class feature is the tell that
this was built by someone who has lived through one.

## 8. The responsible-AI part

- No auto-routing: *you* choose Upgrade vs Rewrite vs Replatform, because a classifier would
  occasionally misroute an expensive, irreversible job.
- The AI authors, but humans execute the risky parts — replatform cutovers are human-run from an
  AI-written runbook, and every gate needs a human yes.
- Knowledge is grounded and labeled: `VERIFIED` from the web, `INFERRED` from the offline fallback,
  never quietly mixed.
- **Where your data goes:** local repo and sessions; nothing leaves except the calls you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin — its skills, hooks, and slash commands (and
  the resumable ledgers) are Claude-Code-native, so it won't run as-is on GitHub Copilot, Cursor, or
  any other agent. The *idea* here ports to other tools; this *implementation* doesn't.
- **The honest caveat:** big rewrites still need a human at every gate; this reduces the cowboy, it
  doesn't remove the pilot.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 6 (3 minutes). The shape: `UPGRADE` a legacy .NET project →
read the gap/risk report → point at a false-upgrade it kicked over to Rewrite → **kill the session**
mid-run → reopen → `UPGRADE RESUME` and watch it continue from the ledger. **Backup:** a mid-run ledger
and a saved gap/risk report.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** Real modernization, scoped honestly and safe to interrupt.
- **Working solution & use of AI — 5.** The AI's role changes per job — orchestrate, author, author-not-execute — behind gates and an oracle.
- **Resourcefulness — 4.** Worktree-per-cluster, per-option target-space DAG decomposition, offline knowledge fallback.
- **Creativity & fun — 4.** Posture-from-distance, resume-from-ledger, the two-gate model.
- **Clear story & readiness — 4.** Nine answers, a three-minute demo, a backup.
- **Responsible AI — 5.** No auto-routing, human-executed cutovers, VERIFIED vs INFERRED, gated throughout.

Nothing below a 4 → **READY.**
