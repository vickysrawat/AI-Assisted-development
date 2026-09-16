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

Two gates, and neither one is a polite suggestion:

- **The spec gate.** Describe a new feature and the AI won't code it. Instead it drafts an **ICEA**
  (Intent, Context, Examples, Acceptance) and waits for you to approve it. No approved spec on disk,
  no implementation. Full stop.
- **The write gate.** Once you *have* approved, every single file still pauses and shows you the diff
  and the exact path before it lands. You approve each one, or approve the batch and still watch every
  diff scroll past.

And the part that makes it real rather than aspirational: these gates aren't the AI promising to
behave. They're **hooks**: code in the harness that runs whether the model likes it or not. Try to
sneak a secret into shared config and a hook stops the commit cold. The AI can't talk its way past it,
because enforcement was never the AI's job.

## 4. Who does what (the AI, the machine, and you)

- **The AI** drafts the spec, flags anything that smells like sensitive data, and, once you say go,
  writes the code and shows you the diffs.
- **The machinery** (the hooks, the secret-scanner, the validators) does the enforcing. It's
  deterministic; the model cannot override it. That separation is the whole point.
- **You** own the two decisions that matter: *should we build this?* and *do I accept this exact
  change?* Everything runs on your local repo and Claude Code; nothing leaves except the ADO and
  Anthropic calls you choose to make.

## 5. How a change actually moves

1. You describe a feature. The AI **declines to code** and drafts the spec instead.
2. It flags any acceptance criterion that touches sensitive data. **You read it and approve**; that's
   the first real checkpoint, and it's yours.
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

What I won't pretend to know: whether the gate saves you rework-hours or shortens cycle time. It
*should*. But I haven't run a real sprint through it with the tracking to prove it, so that stays
**not-yet-evaluated**, and I'd rather tell you that than sell you a number I made up.

## 7. Why it sticks with you

Because it's the AI coding demo where the AI *refuses to code*, and that inversion is genuinely
delightful the first time you see it. Everyone expects the magic trick to be speed. The magic trick
here is a machine with the discipline to wait. People remember that.

## 8. The responsible-AI part (which is really the whole part)

- Two human checkpoints you can't skip by accident: approve the intent, then approve each file.
- Secrets are physically blocked from shared config, not by a rule the model recites, but by a hook
  that runs regardless.
- Sensitive data gets flagged (B1–B7) the moment it shows up in a spec.
- **Where your data goes:** everything stays on your local repo and Claude Code sessions; nothing
  leaves except the ADO/Anthropic calls you initiate; secrets are hook-blocked from committed config.
- **Runs on Claude Code:** this is a Claude Code plugin; its skills, hooks, and slash commands are
  Claude-Code-native, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  here ports to other tools; this *implementation* doesn't.
- **The honest caveat:** the gate adds friction on purpose. There are override paths, but every one
  of them is logged and carries your name, and the things that matter most (secrets, open findings)
  can't be waved through at all.

## 9. The demo (and the backup, because live demos betray you)

Full script in `../demo-scripts.md` §Entry 1 (3 minutes). The shape of it: ask for a quick CSV export
→ watch the AI decline and draft a spec, flagging the sensitive bit → say `APPROVE ADO-1234` → watch
the code come, one reviewable diff at a time → then try to commit a planted secret and watch the hook
slam the door. Open on the refusal; it's the best hook you'll get. Close on the human checkpoint;
it's half the score. **Backup:** a pre-approved spec and a screen recording of the whole run.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** A real, painful problem, answered without a single invented claim.
- **Working solution & use of AI — 5.** The AI, the rules, and the human are cleanly separated, and
  you can watch each one do its job.
- **Resourcefulness — 4.** One spec, reused across the whole lifecycle instead of re-derived.
- **Creativity & fun — 5.** "The AI that refuses to code" is the most memorable beat in the portfolio.
- **Clear story & readiness — 5.** All nine answers, a tight demo, a backup ready.
- **Responsible AI — 5.** Two human gates, hook-enforced secrets, limits stated out loud.

Nothing below a 4 → **READY.**
