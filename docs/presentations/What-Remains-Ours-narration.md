# What Remains Ours — Speaker Script
### The Developer's Craft, Ethics & Responsibility in the Age of AI

*Read-aloud narration for all 27 slides. Each block shows what is on the slide, then the words to say. `**bold**` marks an emphasised (accent-coloured) word on the slide.*

---

## Slide 1 — Title

**On screen**

> **WHAT REMAINS OURS**  
> The Developer's Craft, Ethics & Responsibility in the Age of AI  
> _"The machine can write the code now. What’s left is us — and that turns out to be the important part."_  
> Vivek Rawat · 2026

**Narration**

Before I say anything about AI, I want to say something about us. For most of our careers, the code was the job. You got good at a language, you learned the patterns, and the thing you produced — the code — was the proof of your skill. That's changing, fast. The machine can write the code now. The natural fear is that this makes us smaller. My argument today is the opposite: when the code gets easy, what's left is us — our judgment, our care, our accountability — and that turns out to be the part that always mattered. This talk is about that remainder, honestly: the parts that get better, and the parts we could lose if we're not careful.

---

## Slide 2 — You know the feeling.

**On screen**

> **You know the feeling.**
>
> - The problem clicks. Your hands move. The code just… **flows.**
> - That feeling built our careers.
> - It's becoming the **smallest part of the job.**

**Narration**

Let me start somewhere we almost never go in an engineering talk. Writing code feels good. You know the moment — the problem clicks, your hands are moving, the tests go green, and there's that quiet "I made this." That flow is a real reason a lot of us got into this work. I'm naming it on purpose, because it's exactly the part the machine is absorbing. The typing, the syntax, the boilerplate — that's becoming the smallest part of our day. And if we don't say it out loud, we end up grieving it quietly and calling it "productivity." So let's admit that something we love is changing shape — and then talk about what grows in its place.

---

## Slide 3 — Three honest questions

**On screen**

> **Three honest questions**
>
> - If the code itself is no longer the craft, three questions follow — none of them technical.
> - **Craft** — what is my craft now?
> - **Responsibility** — when it's wrong, who **understands** it, and who **answers** for it?
> - **Team** — a teammate who never sleeps and is sometimes confidently wrong just joined. How do we work together?
> - Everything ahead is an attempt to answer these three.

**Narration**

If the code itself is no longer where the craft lives, three questions follow — and notice none of them are technical. First, craft: if I'm not the one writing it, what is my skill now? Second, responsibility: when that code is wrong — and it will be — who actually understands it, and who answers for it? And third, team: I now have a collaborator who never sleeps, works incredibly fast, and is sometimes confidently, fluently wrong — how do we actually work together? Craft, responsibility, team. Hold those three; everything ahead is an attempt to answer them.

---

## Slide 4 — The ground already shifted

**On screen**

> **The ground already shifted**
>
> - Two years ago, AI suggested the next line. Now it writes **much of the code.**
> - Work that took an hour is routinely handed off.
> - The **‘is this coming?’** debate is over.
> - Our reflexes haven't caught up.

**Narration**

I'll spend exactly one slide on "why now," because I don't think it's the interesting part anymore. Two years ago, AI autocompleted a line. Today it writes whole features, and work that used to take a skilled developer an hour gets handed off in a sentence. Whether that's thirty percent or seventy percent of your code depends on your team — but the direction isn't in doubt, and the "is this really coming?" argument is finished. Here's the part that is interesting: the tools changed in two years, but our instincts didn't. We still reach for the keyboard first. We still measure a good day in lines written. Those reflexes were built for a world that's already gone — and the rest of this talk is about updating them.

---

## Slide 5 — It changed our role — not just our speed

**On screen**

> **It changed our role — not just our speed**
>
> - The code you once made by hand is now made by a **collaborator.**
> - Three things move at once:
> - Your work
> - Your team
> - Your accountability
> - New failure mode: **confidently wrong, at scale.**

**Narration**

Every tool before this made us faster at something we already did — a better IDE, a faster compiler, Stack Overflow. Same job, less friction. This is the first tool that doesn't just speed us up; it relocates us. When the thing you used to produce by hand is now produced by a collaborator, three things move at the same time: what you do all day, who's on your team, and what you're accountable for. And notice how the failure mode changed. A struggling developer used to be slow — you could see it. Now the failure is silent: something plausible and confident slides into production because it was generated faster than anyone could truly read it. That's not a machine defect — it's a human-oversight gap. And it's exactly why this is an ethics talk, not just a productivity one.

---

## Slide 6 — From author to editor

**On screen**

> **From author to editor**
>
> - Writing was the craft. Now **judgment** is.
> - An editor doesn't type less carefully — they **read harder.**
> - Value moves from **producing** the work to **deciding it’s right.**
> - Same accountability. Different muscle.

**Narration**

Here's the reframe I want you to take home. We're moving from being the author of the code to being its editor — and I choose that word carefully, because "editor" is not a demotion. A great editor doesn't write less; they read harder. They have taste. They catch the thing that's technically fine but wrong for the piece, and they're accountable for what goes out the door. That's the muscle we're being asked to grow — not faster typing, but sharper judgment. The uncomfortable part is that most of us trained the author muscle deliberately for ten years, and the editor muscle almost by accident.

---

## Slide 7 — Why this is genuinely hard

**On screen**

> **Why this is genuinely hard**
>
> - It's not a skills gap. It's a **human** one.
> - **The dopamine’s gone** — writing rewards every keystroke; reviewing doesn’t.
> - **It feels like an identity threat** — ‘I’m a coder’ is who many of us are.
> - **The verification trap** — reading closely is tedious, so we’re tempted to just trust it.
> - **Specifying is harder than coding** — a clear spec exposes every fuzzy thought.

**Narration**

If this shift were easy, we'd have made it already. It's hard — and the difficulty isn't technical, it's human, in four specific ways. First, the dopamine's gone: writing code pays you back with every keystroke, but reviewing someone else's work feels slower even when it's faster on the clock. Second, it can feel like an identity threat — "I'm a coder" is who a lot of us are, and directing coders, even AI ones, can feel like drifting from the thing we love. Third, the verification trap: reading generated code carefully is tedious, so the tempting move is to trust it — and the people who skip that step are the ones who ship the bugs. And fourth, the quiet one — specifying what you want is harder than coding it. A clear spec exposes every fuzzy, half-formed thought you used to get away with once your fingers were moving. Most "the AI can't do this" complaints are really "I haven't figured out what I want."

---

## Slide 8 — The skill that matters now is judgment

**On screen**

> **The skill that matters now is judgment**
>
> - — not generation.
> - Senior engineers ship ~2.5× more AI code than juniors —
> - not because they type faster, but because they **catch mistakes faster.**
> - Experience didn’t become obsolete. It became **the whole point.**

**Narration**

Here's the good news buried in all of this, and it's genuinely good news if you've been worried that experience just got devalued. When you actually measure it, senior engineers ship something like two-and-a-half times more AI-generated code than juniors. Not because they're faster typists — the AI types for both of them. It's because they catch the mistakes faster. They read a diff and something smells wrong before they can even say why. That instinct — taste, knowing what "right" looks like in this codebase — used to be the thing you leaned on after you wrote the code. Now it's the main event. Experience didn't become obsolete; it became the whole point.

---

## Slide 9 — Your day inverts

**On screen**

> **Your day inverts**
>
> - Yesterday: ~70% writing code.
> - Today:
> - **~20%** writing code — the parts that truly need a human
> - **~30%** specifying — describing the task crisply enough to hand off
> - **~30%** reviewing — reading diffs, running tests, catching mistakes
> - **~20%** improving the system — prompts, guardrails, tests
> - From production → to **direction & curation.**

**Narration**

Let's get concrete about the day. A senior engineer's day used to be roughly seventy percent writing code and thirty percent everything else. In an agentic workflow that inverts — maybe twenty percent still writing code, the genuinely hard parts; thirty percent specifying, describing tasks crisply enough to actually hand off; thirty percent reviewing what comes back; and twenty percent improving the system itself — the prompts, the guardrails, the tests that make the next task smoother. And here's a feeling worth naming out loud: you will often feel less productive, because the satisfying part shrank — even as you ship more. The work moved from production to direction and curation.

---

## Slide 10 — The new craft: saying exactly what you mean

**On screen**

> **The new craft: saying exactly what you mean**
>
> - A vague ask gets a vague result. **The thinking moves into the spec.**
> - A good spec — any length — answers four things:
> - **Goal** — what outcome, concretely?
> - **Context** — what must it know? (files, conventions, prior decisions)
> - **Constraints & non-goals** — what **not** to do
> - **Acceptance** — how do we know it’s done?
> - Specs are the new source code.

**Narration**

If specifying is now a third of the job, it deserves to be treated as a craft, not a chore. And here's the shift inside the shift: the thinking that used to happen while you typed now happens before, in the spec. A vague ask gets a vague result — "add validation to checkout" gets you something that compiles and probably ships a bug. A good spec, whatever its length, answers four things: the goal, concretely — not "fix the bug" but the exact behaviour you want; the context it can't guess — the files, the conventions, the prior decisions; the constraints and non-goals — what it must not touch, because agents love to over-deliver; and acceptance — how we'll know it's done. This is closer to writing a sharp bug ticket than writing code — and it's a skill that transfers to every teammate you'll ever have, human or not.

---

## Slide 11 — Work in a loop, not a leap

**On screen**

> **Work in a loop, not a leap**
>
> - Define → Think → Execute → Validate
> - **Define** — intent and ‘done’ before prompting
> - **Think** — agent proposes an approach; you review it before any code
> - **Execute** — small diffs, frequent checkpoints
> - **Validate** — tests, and a human gate, before merge
> - The pause between Think and Execute is where **judgment lives.**

**Narration**

The last piece of the working-style change is rhythm. The failure mode with these tools is the leap — you type a request, it writes eight hundred lines, and now you're reverse-engineering a wall of code you never designed. The alternative is a loop: Define, Think, Execute, Validate. Define what you want and what "done" means before you prompt. Let the agent think — propose an approach — and review that before a single line of code exists, because a plan is cheap to fix and code is expensive to unwind. Execute in small diffs with frequent checkpoints. Validate with tests and a human gate before anything merges. If you take one structural habit from this whole talk, make it the pause between Think and Execute — that moment, before the code exists, is where your judgment does its most valuable work.

---

## Slide 12 — A new colleague joined the team

**On screen**

> **A new colleague joined the team**
>
> - Fast. Tireless. Widely read. **Sometimes confidently wrong.**
> - Treat it like any teammate — learn its strengths and failure modes:
> - **Great at** — boilerplate, refactors, tests, well-defined tasks
> - **Weak at** — architecture, ambiguity, novel domains, knowing what it doesn’t know
> - Knowing the boundary **is** the skill.

**Narration**

Let's talk about the third question — the team — because whether we say so or not, a new colleague just joined every one of our teams. It's fast, it's tireless, it's read more code than any of us ever will — and it is sometimes confidently, fluently wrong in a way a human junior rarely is. The healthiest move I've found is to stop treating it as a magic tool and start treating it as a teammate with a very specific personality. Like any teammate, it has strengths and predictable failure modes, and your job is to learn them and scope work to fit. It's genuinely great at boilerplate, refactors, tests — anything well-defined. It's weak at architecture, at ambiguity, at novel domains, and, crucially, at knowing what it doesn't know. Learning that boundary, and staffing work across it, is itself the skill.

---

## Slide 13 — The bottleneck moved: fingers → attention

**On screen**

> **The bottleneck moved: fingers → attention**
>
> - One coder works on one thing. A director runs several agents at once.
> - The new limit isn’t typing speed — it’s **attention bandwidth.**
> - New skills:
> - What to **delegate** vs. do yourself
> - When to **interrupt** an agent going off-track
> - How many things you can **actually** hold in your head

**Narration**

Once you have a teammate like this, the shape of your work changes. A coder works on one thing at a time. A director can have three or four things in flight — one refactoring, one writing tests, one drafting a migration — and suddenly what limits you isn't how fast you type, it's how much you can pay attention to. That's a real and underrated skill: knowing what to delegate and what to keep; knowing when to let an agent run and when to interrupt one that's confidently heading off a cliff; and being honest about how many parallel things you can actually supervise well — because supervising five agents badly is worse than doing two things properly. Attention is the new scarce resource, and protecting it is part of the craft now.

---

## Slide 14 — The uncomfortable question: what about juniors?

**On screen**

> **The uncomfortable question: what about juniors?**
>
> - The AI is best at exactly the work juniors used to learn from.
> - **Seniors thrive** — they already have the judgment to direct and verify.
> - **Juniors risk skipping** the years that built that judgment.
> - If AI does all the ‘easy’ work — where do the next **seniors** come from?
> - Growing people is now a deliberate choice, not a byproduct.

**Narration**

And here's the question I think we have a responsibility not to dodge. The work AI is best at — the boilerplate, the well-defined tickets, the "go figure out how this library works" tasks — is exactly the work juniors used to cut their teeth on. Seniors are thriving precisely because they already have the judgment to direct and verify — but that judgment was built by doing years of the unglamorous work we're now handing to the machine. So there's a real risk: hand the machine all the easy work and you get short-term velocity and a long-term gap, because where do the next seniors come from? This isn't the AI's problem to solve; it's ours. Growing people used to be a byproduct of just doing the work — now it has to be a deliberate choice: leaving some formative work with the humans who need it, and pairing juniors with the judgment they can't yet get from a machine. That's a team-structure decision, and it's an ethical one — which is exactly where we're headed next.

---

## Slide 15 — Verification became a moral act

**On screen**

> **Verification became a moral act**
>
> - Not a QA step. A **duty.**
> - The dangerous output isn’t the obvious error — it’s the **plausible, confident** one.
> - ‘The tests passed’ is not ‘I understood it.’
> - You are the **last line** between generated code and a real user.
> - Trusting unread code isn’t efficiency — it’s negligence with a deadline.

**Narration**

Let's talk about ethics, and I want to start with the one that's easiest to rationalise away. Verification used to be a QA step — quality-assurance-shaped, near the end. In an agentic workflow it becomes a moral act. Here's why: the dangerous output from these systems isn't the obvious error — you'd catch that. It's the plausible one. Confident, well-formatted, right variable names, and quietly wrong in a way that only surfaces in production. "The tests passed" is not the same sentence as "I understood this." And when it ships, you are the last line between that code and a real person who'll trust it with their money, their data, or their safety. So trusting code you didn't read isn't a productivity strategy — it's negligence with a deadline attached. Reading carefully is tedious, and doing the tedious thing anyway is what integrity looks like now.

---

## Slide 16 — Honesty about what you actually know

**On screen**

> **Honesty about what you actually know**
>
> - Don’t present code you **skimmed** as code you **vetted.**
> - Own your confidence — ‘I reviewed this’ vs. ‘the agent generated this.’
> - **Mind provenance** — generated code can carry patterns, licences, others’ work.
> - Disclose where it matters — trust shouldn’t rest on an illusion of diligence.

**Narration**

The second ethic is honesty — specifically about the gap between what you produced and what you actually understand. It's suddenly very easy to open a pull request full of code you skimmed and let everyone assume you vetted it the way you'd vet your own. That's a small dishonesty that compounds fast across a team. So own your real confidence level — there's a difference between "I reviewed this line by line" and "the agent generated this and it looks right," and your reviewers deserve to know which one they're getting. Mind provenance — generated code can carry patterns, licences, and chunks of other people's work you never consciously chose, and yours is the name on the commit. And disclose where it matters. None of this is about shame; it's about not letting the team's trust rest on an illusion of diligence.

---

## Slide 17 — The quiet hazards

**On screen**

> **The quiet hazards**
>
> - Generated code fails in **quiet** ways:
> - **Security** — plausible code hiding a subtle injection or auth gap
> - **Bias** — defaults and assumptions inherited from training data
> - **‘Good enough because the AI did it’** — standards lowered, responsibility disowned
> - The ethic isn’t fear of the tool. It’s **care** — refuse to ship what you wouldn’t stand behind.

**Narration**

Then there are the quiet hazards — the ones that don't announce themselves. Security is the big one: generated code is very good at looking correct while leaving a subtle injection point or an auth check in the wrong place — and if you didn't read it, nobody did. Bias, too — these models carry defaults and assumptions from their training data and will happily bake them into your product unless a human is paying attention. And the subtlest one is cultural: a slow slide toward "eh, good enough, the AI wrote it" — standards quietly lowered, responsibility quietly disowned. Let me be clear: the ethic here is not fear of the tool. It's care. It's refusing to ship something you wouldn't personally stand behind, no matter who or what typed it. Care is the oldest engineering virtue — and it turns out to be the one thing AI can't do for us.

---

## Slide 18 — The AI can’t be responsible. You can.

**On screen**

> **The AI can’t be responsible. You can.**
>
> - Accountability doesn’t transfer to something that can’t **be** accountable.
> - No agent gets fired, sued, or loses a user’s trust. **You do.**
> - ‘The AI wrote it’ has never once been a **defence.**
> - The **credit** is shared. The **responsibility** isn’t.

**Narration**

Question two was about responsibility, and it has a blunt answer: the AI cannot be held responsible, because responsibility isn't something you can hand to a thing that can't be accountable. No model gets fired. No model gets sued. No model loses a user's trust or lies awake about an outage. You do. "The AI wrote it" has never once worked as a defence — not to your users, not to your manager, not to a regulator — and it never will. Here's the asymmetry worth sitting with: the credit for all this productivity gets shared happily — "AI helped me ship this." But the responsibility isn't shared at all. It sits entirely with the human whose name is on the work. That's not a flaw in how we think about it. That's the deal.

---

## Slide 19 — What you own moved up a level

**On screen**

> **What you own moved up a level**
>
> - You’re not the producer of code — you’re the **engineer of the system** that makes it.
> - Yesterday you owned: the code. Today you own:
> - the **spec** and the intent behind it
> - the **guardrails** — what the agent may and may not touch
> - the **review gate** — what requires a human ‘yes’
> - the **recovery plan** — because the agent will be wrong sometimes
> - Same accountability. Larger surface.

**Narration**

So if you're still fully accountable but you're not the one typing, what exactly do you own now? Ownership moved up a level. You used to own the code; now you own the system that produces the code — and that's a bigger surface, not a smaller one. You own the spec and the intent behind it. You own the guardrails — what the agent is allowed to touch and what it absolutely isn't. You own the review gate — what may merge on the agent's say-so versus what requires a human to look up and say yes. And you own the recovery plan, because you're designing for a collaborator that will be wrong sometimes, and a mature engineer builds for graceful failure instead of pretending it won't happen. The keystrokes left. The accountability didn't — it just attached to a bigger set of decisions.

---

## Slide 20 — The same tool. Two futures.

**On screen**

> **The same tool. Two futures.**
>
> **For good ↑**
> - **Leverage** — one person does a team’s work
> - **Focus** — spend yourself on the hard 20%
> - **Access** — more people get to build
> - **Learning** — a patient explainer, always on
> - **Ambition** — ‘not worth it’ projects, now viable
>
> **For worse ↓**
> - **Skill atrophy** — unused muscles fade
> - **Over-trust** — confident wrong, merged unread
> - **Sameness** — everyone’s average solution
> - **Shallow** — code no human truly grasps
> - **Hollow pipeline** — no juniors → seniors
>
> _Same tool in both columns. The only variable is us._

**Narration**

Let's be honest in both directions at once — because a talk that's only excited, or only worried, is useless. Look at these side by side, because it's the same tool in both columns. On the left, the good, and it's real: leverage — one person attempting a team's work; focus — spending your attention on the hard twenty percent while the boring eighty is handled; access — more people getting to build; learning — a patient explainer for any codebase; ambition — projects that were never "worth it" suddenly viable. And on the right, with equal honesty: skill atrophy, because the muscles you stop using you lose; over-trust — the confident wrong answer merged because reading it was tedious; sameness, as everyone drifts toward the model's average solution; shallow understanding — shipping systems no human truly grasps; and a hollowed pipeline with no path from junior to senior. Add one more to the right column that belongs there: "the AI did it" hardening from an excuse into a culture. Now — here's the uncomfortable part. The tool is identical in both columns. The only variable is us.

---

## Slide 21 — Which future we get is a choice.

**On screen**

> Which future we get is a **choice.**  
> The technology doesn’t decide this. We do — one diff, one spec, one review at a time.  
> Keep your **judgment, honesty, and care** switched on.

**Narration**

So which future do we get? Here's what I most want you to leave with: the technology does not decide that — we do. And not in some grand policy sense, but in the small, daily, unglamorous decisions. The diff you actually read instead of rubber-stamping. The spec you wrote clearly instead of hand-waving. The junior you paired with instead of handing their growth to a model. Keep judgment, honesty, and care switched on, and you live in the left column. Switch them off, and no tool will save you from the right one. Which raises a fair question — what does "switched on" actually look like, day to day? That's where we go next.

---

## Slide 22 — What ‘switched on’ looks like

**On screen**

> **What ‘switched on’ looks like**
>
> - You can tell someone’s made the shift when they:
> - Write a short **spec** before launching an agent — every time.
> - **Review every diff** before merge — especially when the agent sounds confident.
> - Can say, for any task, **why** it should or shouldn’t be delegated.
> - Invest in their **prompts, tools, and guardrails** — not just use them.
> - Measure themselves on **tasks shipped and understood** — not lines written.

**Narration**

So what does "switched on" look like, concretely? You can spot someone who's made the shift by a handful of habits. They write a short spec before launching an agent — every time, not just when they remember. They review every diff before merge, no matter how confident the agent sounds — especially when it sounds confident. They can tell you, for any task, why it should or shouldn't go to a model — they know the boundary. They invest in their prompts, tools, and guardrails rather than just consuming them. And they measure themselves on tasks shipped and understood, not lines written. Compressed to one line: they treat the discipline as the job — not as overhead on top of the job.

---

## Slide 23 — Make the discipline structural — not heroic

**On screen**

> **Make the discipline structural — not heroic**
>
> - Every habit here means doing the tedious thing when you’re tired.
> - Willpower doesn’t scale. **Systems do.**
> - Don’t **remember** to write a spec — make code un-writable until one exists.
> - Don’t **hope** you’ll review — put a gate in the way.
> - Don’t rely on memory — write the lesson where it’ll resurface.
> - Bake judgment in, so the **easy path is the right path.**

**Narration**

Here's the problem with everything I just listed, though: every one of those habits means doing the tedious thing precisely when you're tired, behind, and the demo's in an hour. And willpower doesn't scale — not across a career, and definitely not across a team. Systems do. So the real move isn't to try harder; it's to make the discipline structural. Don't rely on remembering to write a spec — make it so code can't be written until one exists. Don't hope you'll review carefully — put an actual gate in the path. Don't count on recalling the lesson from last month — write it down where it'll resurface at the right moment. Bake the judgment into the workflow so the easy path and the right path are the same path. Because a discipline that needs heroism every single day is a discipline that will fail on a Thursday afternoon.

---

## Slide 24 — One way we made it structural

**On screen**

> **One way we made it structural**
>
> - (An example — the point is the habit, not the tool.)
> - We wired the disciplines into how the work flows:
> - **Spec before code** — no implementation until an approved intent exists
> - **A gate you must clear** — nothing merges on the agent’s say-so alone
> - **A built-in skeptic** — the plan argues against itself before a human sees it
> - **Memory** — mistakes and decisions captured, so they don’t repeat
> - None of this is the point. The **habits** are.

**Narration**

Let me give you one concrete example of making it structural — and I want to be clear this is an example, not a sales pitch. Because we kept leaning on willpower and kept getting burned, we wired the disciplines directly into how our work flows. There's a rule that no implementation code gets written until there's an approved spec of intent — the spec isn't optional, it is the gate. There's a review gate nothing merges through on the agent's say-so alone; a human clears it. There's a built-in skeptic that makes the plan argue against itself before any of us even see it — the adversarial review we all know we should do and rarely have the discipline for. And there's memory, so the mistake from last sprint and the decision from last month actually resurface, instead of getting relearned the hard way. I'm not showing you this because the tooling matters — it doesn't, and yours will look different. I'm showing you that the habits we spent this whole talk on are real enough, and slippery enough, to be worth building a system around. The habit is the point. This was just what "structural" happened to look like for us.

---

## Slide 25 — What remains ours

**On screen**

> **What remains ours**
>
> - **Craft** → judgment, taste, knowing what ‘right’ means here.
> - **Responsibility** → still entirely ours. It never left.
> - **Team** → we don’t just use the new colleague — we **lead** them.
> - The machine took the typing. It left us the **thinking, the caring, and the answering.**
> - That was always the job.

**Narration**

Let's close where we started. I opened with three questions — craft, responsibility, team — so let me answer them plainly. Craft didn't disappear; it moved up, into judgment, taste, and knowing what "right" actually means in this context. That was always the hardest part of the work — now it's the whole part. Responsibility never left us for a second; the machine can't hold it, so it's still entirely ours. And team: we don't merely use this new colleague, we lead them — we decide what they touch, we check their work, we answer for it. So here's what remains ours: the machine took the typing, and it left us the thinking, the caring, and the answering. And if you've been doing this a while, you already know — that was always the job. The code was just the part that showed.

---

## Slide 26 — The code got easy.

**On screen**

> The code got easy.  
> What’s left is **us** — and that’s the part that always mattered.  
> Keep your judgment, honesty, and care switched on.  
> Thank you.

**Narration**

The code got easy. What's left is us — our judgment, our honesty, our care — and that turns out to be the part that always mattered. Keep it switched on. Thank you.

---

## Slide 27 — Questions & Discussion

**On screen**

> Questions & Discussion  
> What’s one habit you’ll make **structural** this week?

**Narration**

I'd love to hear where you're feeling this in your own work — and I'll leave you with one question to answer for yourself before you leave: what's one habit you'll make structural this week? Let's talk.

---

