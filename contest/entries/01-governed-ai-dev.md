# Entry 1 — Governed AI Development

> The one where the AI coding assistant does the bravest thing an AI can do: it says *"not yet."*
> Category: Responsible AI · Priority: flagship · Status: READY
> Numbers are pulled from `../measured-claims.md` and labeled honestly; the demo lives in
> `../demo-scripts.md` §Entry 1.

---

## 1. The pitch, in one breath

Most AI coding tools race to impress you with how fast they can write. This one earns your trust by
refusing to write anything at all, until there's a spec you've actually read and approved. It's the
pair-programmer who says *"hold on, what are we really building, and who said we could?"* before it
touches a single file.

## 2. Why it exists

Anyone who's watched an AI assistant work knows the quiet dread. It's *fast*, and that speed is
exactly the problem. It'll happily build a feature nobody asked for, quietly reach into data it
shouldn't, and drop thirty files in your lap before you've had a chance to think. Then a month later
someone asks *"why does this exist?"* and there's no answer. Just… vibes and a git blame.

In a normal side project, fine. But in a hospital's billing system, a law firm's matter database, a
bank's ledger: *"the AI already wrote it"* is not something you can say to an auditor with a straight
face. There, **what** got built and **who signed off** matter every bit as much as how quickly it
shipped.

So this is built on a slightly heretical bet: in serious work, the valuable thing isn't the AI's
speed. It's its *restraint*. This is for the teams who feel that in their gut: the leads, the
engineers, the QA folks who've been burned by "move fast" and want the moving to be *accountable*.

## 3. What actually works today

Three things, none of them polite suggestions:

- **The spec gate.** Describe a new feature and the AI won't code it. Instead it drafts an **ICEA**
  (Intent, Context, Examples, Acceptance) and waits for you to approve it. No approved spec on disk,
  no implementation. Full stop.
- **The write gate.** Once you *have* approved, every single file still pauses and shows you the diff
  and the exact path before it lands. You approve each one, or approve the batch and still watch every
  diff scroll past.
- **The domain context.** Before any of that, the system identifies which business domain it operates
  in — legal, healthcare, fintech — and grounds its sensitivity rules in the actual regulations that
  apply. So when the spec gate flags "this acceptance criterion touches client matter data," it isn't
  a generic PII check. It's a domain-calibrated trigger, and the same trigger fires again at every
  checkin, review, and readiness assessment — not just at spec time.

None of the three work at full strength in isolation. Underpinning them: a **knowledge graph** so
the AI understands codebase structure before it touches anything; **architecture docs** as the shared
ground truth every skill reads from; **cross-repo visibility** so the spec gate isn't blind to blast
radius in a dependent service; a **context budget** that keeps the instruction file lean enough that
the model actually follows its own governance rails; and **project memory** (Dream) that consolidates
decisions, resolved bugs, and confirmed conventions across sessions — because governance that forgets
its own history between sessions isn't governance, it's a suggestion that expires when the session
closes. Remove any of these and the gates become less precise or less reliably enforced.

And the part that makes it real rather than aspirational: these gates aren't the AI promising to
behave. They're **hooks**: code in the harness that runs whether the model likes it or not. Try to
sneak a secret into shared config and a hook stops the commit cold. The AI can't talk its way past it,
because enforcement was never the AI's job.

## 4. Who does what (the AI, the machine, and you)

- **The AI** drafts the spec, flags domain-calibrated sensitive data using the B-series triggers
  grounded in your industry's actual regulations, and once you say go, writes the code and shows
  you the diffs — oriented by the knowledge graph and the architecture docs rather than re-reading
  the whole codebase from scratch.
- **The machinery** (the hooks, the secret-scanner, the validators, the knowledge graph, the
  architecture baseline, Dream's memory) does the underpinning. It's deterministic; the model cannot
  override it. That separation is the whole point.
- **You** own the decisions that matter at every stage: approve the domain policy, approve the spec,
  approve each file. Everything runs on your local repo and Claude Code; nothing leaves the
  environment except API calls you explicitly make — to Azure DevOps or Anthropic.

## 5. How a change actually moves

1. You describe a feature. The AI **declines to code** and drafts the spec instead.
2. It flags any acceptance criterion that touches sensitive data — using domain-calibrated B-series
   triggers, so "client matter data in a law firm" isn't treated the same as a name field in a
   todo app. **You read it and approve**; that's the first real checkpoint, and it's yours.
3. Now, and only now, it generates code, and **each file stops at the write gate** with its diff and
   path for you to accept.
4. At commit time, the secrets hook quietly scans the staged config. A planted key never makes it in,
   and you didn't even have to remember to check.

## 6. What it's worth (told straight, labeled straight)

The honest truth is that the deepest value here, *auditability*, isn't a number, it's a property:
every feature traces back to an approved spec, every file to an explicit yes. That's **measured** in
the plainest sense: the gates are real hooks, the files exist, you can go look.

And this isn't a weekend hack dressed up. It's a disciplined system: **25 governance hooks**, **300
structural checks passing, 0 failing**, 49 skills, 44 rule files, all verifiable with a one-line
command (`../measured-claims.md` §1). *(measured)*

And because the approved spec becomes the shared artifact that the security scan, the readiness
assessment, the handover checklist, and the critic all read from, one human approval at the spec gate
pays forward across the entire project lifecycle. *(measured: those skills read the approved ICEA on
disk.)*

And because Dream consolidates architectural decisions, resolved bugs, and confirmed conventions from each
sprint into project memory, the governance compounds over time rather than evaporating when the
session closes. A constraint established last week is still in force next week — not because someone
remembered to re-explain it, but because the system remembered it. *(measured: Dream's append-only
log and tiered approval model exist.)*

What I won't pretend to know: whether the gate saves you rework-hours or shortens cycle time. It
*should*. But I haven't run a real sprint through it with the tracking to prove it, so that stays
**not-yet-evaluated**, and I'd rather tell you that than sell you a number I made up.

## 7. Why it sticks with you

Because it's the AI coding demo where the AI *refuses to code*, and that inversion is genuinely
delightful the first time you see it. Everyone expects the magic trick to be speed. The magic trick
here is a machine with the discipline to wait. People remember that.

## 8. The responsible-AI part (which is really the whole part)

- Human checkpoints at every stage: approve the domain policy before it governs anything, approve
  the spec before a line is written, approve each file before it lands. None of these can be skipped
  by accident.
- Secrets are physically blocked from shared config, not by a rule the model recites, but by a hook
  that runs regardless.
- Sensitive data gets flagged (B1–B7) the moment it shows up in a spec — domain-calibrated, not
  generic, with the trigger ID and the regulatory basis stated out loud.
- Governance decisions are themselves tracked, audited, and reversible: Dream's append-only log
  means every memory promotion carries a citation, every run can be rolled back, and nothing is
  promoted to the always-on context without your explicit approval.
- **Where your data goes:** everything stays on your local repo and Claude Code sessions; nothing
  leaves the environment except API calls you initiate — to Azure DevOps or Anthropic; secrets are
  hook-blocked from committed config.
- **Runs on Claude Code:** this is a Claude Code plugin; its skills, hooks, and slash commands are
  Claude-Code-native, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  here ports to other tools; this *implementation* doesn't.
- **The honest caveat:** the gate adds friction on purpose. There are override paths, but every one
  of them is logged and carries your name, and the things that matter most (secrets, open findings)
  can't be waved through at all.

## 9. The demo (and the backup, because live demos betray you)

Full script in `../demo-scripts.md` §Entry 1 (3 minutes). The shape of it: ask for a quick CSV
export → watch the AI decline and draft a spec, flagging the sensitive bit → set the domain to
healthcare, watch the same finding jump from medium to Critical with the trigger ID stated out loud
("that's the same finding — this one knows which app it's in") → say `APPROVE ADO-1234` → watch
the code come, one reviewable diff at a time → then try to commit a planted secret and watch the
hook slam the door. Open on the refusal; it's the best hook you'll get. Close on the human
checkpoint; it's half the score. **Backup:** a pre-approved spec and a screen recording of the
whole run.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** A real, painful problem, answered without a single invented claim.
- **Working solution & use of AI — 5.** The AI, the rules, and the human are cleanly separated, and
  you can watch each one do its job.
- **Resourcefulness — 5.** One approved spec reused across every downstream skill; one domain policy
  applied across every review; one knowledge graph orienting every generation and explanation; one
  Dream log compounding governance across every session. The whole system reuses rather than re-derives.
- **Creativity & fun — 5.** "The AI that refuses to code" is the most memorable beat in the portfolio.
- **Clear story & readiness — 5.** All nine answers, a tight demo, a backup ready.
- **Responsible AI — 5.** Human checkpoints at every stage, hook-enforced secrets, governance decisions audited and reversible, limits stated out loud.

Nothing below a 4 → **READY.**
