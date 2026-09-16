# Entry 13 — Business Context (domain-aware severity)

> The one where the same bug is a shrug in one app and a reportable breach in another, and the AI
> finally knows the difference.
> Category: Responsible AI + Practical value · Status: READY (bonus)
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 13.
>
> Boundary vs Entry 11: that entry is *how* this policy gets researched safely (the two agents that
> can't collude). This entry is *what the policy is and what it governs*: the domain-aware severity
> that reshapes every review. One system, two lenses.

---

## 1. The pitch, in one breath

A PII leak in a to-do app is a medium-severity bug. The same leak in a hospital or a law firm is a
reportable breach. Most tools score both identically. This one learns your actual business domain,
grounds a sensitivity policy in the real regulations that apply to it, and then quietly raises the
stakes on every finding that touches something that matters.

## 2. Why it exists

Technical severity scores (CVSS and friends) are context-blind by design. They'll tell you a finding
is a 7.5 whether the data behind it is cat photos or someone's medical history. But *business* severity
isn't blind: in a regulated domain, "PII logged to the console" isn't informational, it's a
confidentiality breach with notification obligations attached.

If your AI reviews everything on the technical score alone, it will confidently wave through the finding
that actually ends your afternoon in a compliance meeting. The fix is to teach the tooling what
*business* it's operating in, and to make that context able to *raise* severity, because a floor that
can't rise isn't protecting anyone. This is for teams in regulated or sensitive domains (legal,
healthcare, fintech, government) who need their AI reviews to reason about consequences, not just CVSS.

## 3. What actually works today

The plugin identifies your domain (inferred from your data model, then confirmed with you) and your
jurisdiction, and grounds a **B-series** (an ordered list of sensitivity triggers, as long as the
domain demands) in cited regulatory frameworks. Some domains, like legal, come from a locked preset
copied word-for-word; others start from a checklist and get grounded. The result is written to
`.claude/business-context.md` only after you approve it, with a citation and a date on every trigger.

From then on, *every* review skill (security, code review, spec review, the pre-commit gate, the
critic, the readiness assessments) resolves that B-series and applies one rule: a finding's reported
severity is the **higher** of its technical score and its business severity. Business context can only
raise, never lower, and when it does, the override is stated out loud, by trigger ID.

## 4. Who does what (the AI, the rule, and you)

- **The AI** infers the likely domain, grounds the triggers in real regulations, and applies the
  override across every review, flagging *which* trigger fired and why.
- **The rule is fixed and non-negotiable:** technical severity is a floor, never a ceiling; the
  override check runs on *every* finding in *every* review, not just security ones.
- **You** confirm the domain and jurisdiction (one question), and approve the policy before it's
  written. Locked domains are copied byte-for-byte; you can only *add* project-specific triggers, never
  quietly rewrite the locked ones.

## 5. How a severity gets decided

1. Set the domain once (`SET DOMAIN`, or automatically at setup): infer → confirm → ground in cited
   regulations → **you approve** → policy written.
2. A review runs and finds something. It computes the technical severity as usual.
3. It asks: does this finding touch a B-series trigger? If yes, it takes the higher severity and
   **states the override, citing the trigger by ID**, e.g. "Critical (business override — B1: regulated
   confidential records), technical score CVSS 7.5."
4. Anything business-Critical *blocks*; it's not a warning you can scroll past.

## 6. What it's worth (told straight, labeled straight)

The value that shows up everywhere is a single, consistent principle applied across the whole toolchain:
**"CVSS is a floor, not a ceiling."** The B-series is resolved project-local-first, the override is
disclosed by ID, and it changes severity, yes, but also *what counts as a finding at all* and *what counts
as done*: for real regulated data, "delete the file" isn't remediation until git history is purged and
access logs are checked. *(measured: the severity model and the override discipline are specified and
consumed by every review skill; `../measured-claims.md`.)*

What I won't oversell: whether this actually catches more *real* domain breaches than a generic scan.
That's **not-yet-evaluated**; it's a well-grounded design, not a measured hit-rate.

## 7. Why it sticks with you

Because it reframes severity as a human question instead of a math one. The line does the work: *the
same bug is a shrug in a to-do app and a breach in a hospital; this knows which app it's in.* And it's
honest about the override: it never silently inflates a score; it shows you the technical number, the
business number, and exactly which regulation-grounded trigger made the difference. That transparency is
what makes it trustworthy rather than alarmist.

## 8. The responsible-AI part

- Business context can only *raise* severity, never lower it, and every override is disclosed by
  trigger ID with the technical score shown alongside. No silent inflation, no silent suppression.
- Triggers are grounded in cited regulations with a retrieval date; locked domains are protected from
  edits; the policy is written only on your explicit approval.
- It reshapes remediation honestly: for committed regulated data, it tells you the file deletion isn't
  enough on its own.
- **Where your data goes:** the policy lives in your repo; grounding is handled by the airgapped agents
  of Entry 11 (the web researcher never sees your code); nothing else leaves.
- **Runs on Claude Code:** this is a Claude Code plugin; the B-series is consumed by Claude-Code-native
  review skills and hooks, so it won't run as-is on GitHub Copilot, Cursor, or another agent. The *idea*
  (business severity as a floor-raising override) ports; this *implementation* doesn't.
- **The honest caveat:** the grounding is best-effort and human-reviewed, not a substitute for a
  compliance lawyer; and it only protects the domains you've actually configured.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 13 (2 minutes). The shape: show a finding scored medium on
CVSS in a generic app → set the domain to healthcare → re-run and watch the same finding become
Critical, with the override stated by trigger ID and the technical score shown beside it → point out
that it *blocks* now, and that "delete the file" is no longer enough. **Backup:** a saved
`business-context.md` with cited triggers and a before/after severity screenshot.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** Severity that reflects real-world consequences, applied across every review.
- **Working solution & use of AI — 4.** One severity model, consumed everywhere; overrides disclosed by ID.
- **Resourcefulness — 4.** A single B-series drives the whole toolchain; locked presets reuse regulatory work.
- **Creativity & fun — 4.** "The same bug is a shrug or a breach — it knows which app it's in."
- **Clear story & readiness — 4.** Nine answers, a demo, a backup, held on the policy lens vs Entry 11.
- **Responsible AI — 5.** Raise-only overrides, disclosed by ID, cited grounding, honest remediation.

Nothing below a 4 → **READY.**
