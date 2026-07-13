# Talking Points — Leadership Briefing

**Deck:** `ai-assisted-development-leaders.html` · **Audience:** Leads / Management
**Runtime:** ~30 min · **Slides:** 15 (~2 min each) · **Demos:** none (mockups only)

**Opening hook (say before slide 1):** *"AI is already writing code across our teams. The
question isn't whether we use it — it's whether we can govern it. Here's how we turn a
productivity tool into a controllable process."*

Delivery notes: outcomes-first, minimal command syntax, leave ~4 min for discussion. Press `S`
in the deck for the same notes on screen; `O` for the slide map.

---

### Slide 1 — Title · ⏱ 0:00–1:00
- Set the frame: governed AI development at team scale.
- Name the three things they'll judge it on: **risk, cost, quality.**
- → "Let me tell you what you'll leave knowing."

### Slide 2 — What you'll leave with · ⏱ 1:00–3:00
- Four questions: problem it solves, how it lowers risk, cost/savings, how we measure it.
- Everything else is detail in service of these four.
- → "Start with the problem — the quiet one."

### Slide 3 — The business problem · ⏱ 3:00–6:00
- Rework was the dominant cost; blocked PRs traced to thin/absent specs.
- Quality varied by person; knowledge walked out the door; security rigor was uneven.
- Land the ROI line: **one good spec prevents ~3 bounced PRs** (ADR 0001).
- → "So what did we build to fix that?"

### Slide 4 — What it is · ⏱ 6:00–8:00
- One sentence: a **governance layer over AI-assisted coding**.
- Accountable · auditable · efficient · consistent — one workflow, every stack.
- → "The core idea is simple enough to state in one line."

### Slide 5 — The core idea: approval gates code · ⏱ 8:00–11:00
- The AI **cannot write source** until a named person approves a spec.
- Output-gated, not friction: thinking/exploration stays free; only shipping unreviewed code is blocked.
- This one constraint is what drives the rework reduction.
- → "For anyone who owns audit or compliance exposure, this next slide matters most."

### Slide 6 — Governance & auditability · ⏱ 11:00–14:00
- Every change → an approved spec + a named approver, on disk.
- Persistent finding ledgers; 45 ADRs; mechanical enforcement (git hooks + validator).
- Emphasis: governance that **holds under deadline pressure**, not just when people remember.
- → "Now the number the CFO will ask about."

### Slide 7 — Cost that scales · ⏱ 14:00–17:00
- **The driver:** the plugin understands the codebase *once* and reuses it, instead of re-learning it every run. Caching is a bonus on top.
- Result: 80–95% lower per-run token cost after the first baseline.
- Translate: faster feedback, lower spend, and **savings grow as the codebase grows** (more of it is already understood).
- → "Cost matters, but risk matters more — especially our kind of risk."

### Slide 8 — Security that understands our business · ⏱ 17:00–20:00
- SAST + DAST with tracked findings; **business-context severity** (B1–B7).
- The point: a technically-minor issue touching sensitive client data is auto-escalated to Critical and **blocks the commit.**
- Context can raise severity, never lower it.
- → "And we don't just assert quality — we measure it."

### Slide 9 — Measured quality · ⏱ 20:00–22:30
- Three KPIs pulled from Azure DevOps each sprint: ICEA compliance, PR rejection rate, rework hours.
- Note the figures are illustrative; the real board populates them.
- The workflow's value is **measured, not asserted** — the trend tells us if it's working.
- → "There's a people-risk angle too."

### Slide 10 — Institutional memory · ⏱ 22:30–24:30
- Knowledge retained across sessions and staff changes → less key-person risk, faster onboarding.
- Auditable and reversible — never a black box.
- → "Before go-live, we get a consistent signal."

### Slide 11 — Go-live assurance · ⏱ 24:30–26:00
- `app-readiness` scores 8 domains → a repeatable go/no-go, not gut feel.
- → "And this scales because it's the same everywhere."

### Slide 12 — One standard, every team · ⏱ 26:00–27:30
- Same workflow across .NET, Java, Python, Node, Angular, React — only language rules differ.
- One thing to train on; standards travel with people; comparable reviews across projects.
- → "So what would adoption actually look like?"

### Slide 13 — Adoption path · ⏱ 27:30–28:30
- Pilot → measure → expand → standardize. Setup per project is one guided command.
- Key reassurance: **we can prove value on a pilot before any broad commitment.**
- → "Here's the whole value on one slide."

### Slide 14 — Value scorecard · ⏱ 28:30–29:30
- The "photograph this" slide: each concern → what the plugin delivers.
- Rework, cost, security risk, knowledge loss, inconsistency, release risk.
- → "To wrap up."

### Slide 15 — Close · ⏱ 29:30–30:00 + discussion
- Four headlines: Accountable · Efficient · Measured · Consistent.
- **The ask:** approve a one-team, one-sprint pilot, judged on the KPIs shown.
- Open the floor.

---

## Q&A prompt-bank
- *"How much effort to adopt?"* → One guided setup command per project; pilot is one sprint.
- *"Does it slow developers down?"* → Output-gated: only unreviewed code is blocked; exploration is free. Net faster via less rework.
- *"What about our sensitive data?"* → B1–B7 business severity auto-escalates and gates findings touching privileged/immigration/vulnerable-client data.
- *"How do we know it's working?"* → Sprint KPIs from Azure DevOps: compliance, rejection rate, rework hours.
- *"What if the AI is wrong?"* → Nothing ships without a named human approval; findings tracked, dismissals justified and reversible.
- *"Cost?"* → 80–95% lower per-run token cost after baseline; scales down as the codebase is already understood.
