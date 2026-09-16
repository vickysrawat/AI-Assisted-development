# Entry 8 — Support Handover (Operations + Go-Live)

> The one that writes the two documents a support team actually needs to take an app off your hands,
> and marks what it doesn't know instead of quietly waving it through.
> Category: Clear story / demonstrated readiness · Status: READY
> Numbers pulled from `../measured-claims.md` §4 and labeled honestly; demo in `../demo-scripts.md` §Entry 8.

---

## 1. The pitch, in one breath

Support handover is usually a folder of tribal knowledge and a meeting where everyone nods. This writes
the two documents that meeting is missing: the runbook a tired engineer opens at 3am, and the go/no-go
checklist a support team uses to decide whether they'll accept the app at all. Both are built from evidence,
neither one willing to fabricate.

## 2. Why it exists

Handover is where knowledge goes to die. There's no runbook, or there's a stale one nobody trusts. And
"can we accept this into support?" gets decided on gut feel, because the evidence is scattered across
five tools.

Two genuinely different needs get mushed together or skipped entirely: *how do I operate this thing in
production*, and *should we take responsibility for it at go-live*. And the failure mode that scares me
most is an AI cheerfully inventing a rollback step, because a *wrong* rollback step at 3am is far more
dangerous than a missing one. This is for the support and SRE teams on the receiving end of a handover,
and the delivery teams trying to give them something honest.

## 3. What actually works today

`/operations` writes the master runbook: sixteen sections, from the at-a-glance summary through the
dependency map, the routine ops, the failure-mode playbooks, the escalation path, with four real
Mermaid diagrams. It's Markdown you can grep, plus a self-contained HTML companion that opens offline,
no internet required.

`/go-live` writes the one-time acceptance checklist, and it doesn't re-analyze anything. It *ingests*
what the other skills already produced: the readiness report, the security ledger, the code-review
ledger, the deployment architecture; and turns their open findings into go-live blockers and
fast-follows, ending in an honest go / conditional-go / no-go.

## 4. Who does what (the AI, the ledgers, and you)

- **The AI** derives both documents from evidence (architecture, config, pipelines, ledgers), draws
  the diagrams, and writes the recommendation.
- **The ledgers are the source of truth**: go-live copies every finding ID *verbatim*; a missing ledger
  doesn't become a silent pass, it becomes a visible "unverified" blocker.
- **You** close the "⚠ TODO"s with the owning team, and you make the actual accept call: the people,
  the dates, the sign-offs are always yours. Operations reads a few source files (with consent) for
  playbooks; go-live reads reports and ledgers only, never source.

## 5. How a handover comes together

1. `/operations` derives the runbook, flags every unknowable as "⚠ TODO," and renders Markdown plus an
   offline HTML companion. **You close the TODOs with the team that owns them.**
2. `/go-live` ingests the readiness, security, and code-review ledgers plus the deployment and pipeline
   state → lays out the blockers and the fast-follows → and makes a go / conditional / no-go call. **You
   make the real decision.**

## 6. What it's worth (told straight, labeled straight)

The core promise is honesty under uncertainty: it **degrades to a TODO, it never false-passes.** A
missing ledger means the risk is *unverified*, and unverified is a blocker row, not a green tick. It
will not say "go" while a single red blocker is open. *(measured; these are hard rules;
`../measured-claims.md` §4.)*

It's also genuinely frugal and safe: go-live reads reports and ledgers only, never your source, and
copies every finding ID straight from its ledger so nothing is invented. And it's the *capstone*: the
one place all the other skills' outputs turn into a single accept/reject decision. *(measured.)*

What I can't claim yet: that it lowers mean-time-to-restore or makes handovers smoother in practice.
That's **not-yet-evaluated**; it depends on real teams using it over real incidents.

## 7. Why it sticks with you

The line to land: *"missing input becomes a visible TODO, never a silent pass."* Anyone who's inherited
a handover doc that quietly glossed over the one thing that later took them down at 3am knows the cost
of the alternative. A doc that *tells you what it couldn't verify* is the one worth trusting: the
handover that writes itself, with the integrity to mark the parts it can't.

## 8. The responsible-AI part

- It never fabricates: a wrong rollback step is more dangerous than a missing one, so unknowns are
  "⚠ TODO" and missing evidence is "unverified," not "fine."
- You own the accept call: owners, dates, sign-offs, and the final go/no-go are always human.
- Scope and secrets: operations reads at most a handful of source files with consent; go-live reads no
  source at all; secret *names* appear, never values.
- **Where your data goes:** local docs, ledgers, and the offline HTML — no CDN, no remote assets;
  nothing leaves except the calls you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin; its skills, hooks, and slash commands are
  Claude-Code-native, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  here ports to other tools; this *implementation* doesn't.
- **The honest caveat:** it's only as good as the ledgers upstream of it; no security scan, and it
  tells you that's unverified rather than guessing you're fine.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 8 (3 minutes). The shape: `/operations` → open the runbook
HTML and the triage/escalation diagram → `/go-live` → the acceptance checklist, with blockers pulled
from real open findings and "⚠ TODO" rows where inputs were missing → say the line about the silent
pass. **Backup:** a pre-generated runbook and checklist.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** The two documents a support team genuinely needs to accept an app.
- **Working solution & use of AI — 4.** Evidence-derived; go-live ingests real ledgers; no invented findings.
- **Resourcefulness — 4.** Go-live reuses the other skills' outputs; the HTML companion is fully offline.
- **Creativity & fun — 4.** "The handover that writes itself," and TODO-not-false-pass.
- **Clear story & readiness — 5.** Nine answers, a demo, a backup, and a clean operate-vs-accept split.
- **Responsible AI — 5.** Never-fabricate, unverified-is-a-blocker, source-free go-live, secret names only.

Nothing below a 4 → **READY.**
