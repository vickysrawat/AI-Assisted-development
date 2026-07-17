# Narration Humanizer — Session Plan
# File: ai-assisted-development-story.pptx
# Last updated: 2026-07-15
# Resume from: SLIDE 16

---

## PROGRESS

> **▶ RESUME AT: SLIDE 16**

| Slide | Status | Narration Summary |
|---|---|---|
| 1 | ✅ Locked | "Who is still writing code?" → four things AI cannot take → Craft, Responsibility, Team, Judgment |
| 2 | ✅ Locked | Old process on screen → audience question → "I bet… most of us. Because it works. And it did — for a long time. So what quietly changed?" |
| 3 | ✅ Locked | The reviewer quietly replaced by AI → double question (writer + reviewer) → "gone from both ends" → "Everything I built next was one long attempt to put that missing check back" |
| 4 | ✅ Locked | Coding cheaper, thinking more valuable → five responsibilities → "less like coding, more like conducting" → "So let's look at each of these five" |
| 5 | ✅ Removed | Content covered better by Slide 6 — no narration needed |
| 6 | ✅ Locked | The matrix → Spec, Trust, Continuity, Knowledge, Observability → "Five gaps. Five systems. Let's go through them one by one" |
| 7 | ✅ Locked | Plugin vs prompt library → "suggestion is not enough, you need something that actually holds" → "five discoveries, each one unlocking the next. Let's start with the first" |
| 8 | ✅ Locked | Discovery one: Spec → AI never asks "are you sure?" → "Someone has to capture the intent before that happens, and that someone is you" |
| 9 | ✅ Locked | Requirement scattered in stories/email/chat → AI builds against assumptions → "That is why we built the spec process. To make sure the AI is not assuming, and you are not rewriting" |
| 10 | ✅ Locked | ICEA defined → Intent, Context, Examples, Acceptance → each explained as flowing sentence → "It is the thinking that used to just not happen" |
| 11 | ✅ Locked | Sample ICEA on screen → "What you're looking at is a sample ICEA format. Let me show you the real one." → live walkthrough |
| 12 | ⏭ Skipped | Content covered during live ICEA walkthrough |
| 13 | ⏭ Skipped | Content covered during live ICEA walkthrough |
| 14 | ✅ Locked | Act two: trust without measurement → gates exist but reviewing unseen judgment → "Let's look at the failure scenario" |
| 15 | ✅ Locked | Review timing gap → ICEA before code, code review after spec forgotten → generalist AI misses specialist issues → "That is not trust. That is just hoping." |
| **16** | **▶ RESUME HERE** | Draft ready — critic narration, not yet approved |
| 17 | 🔲 Pending | — |
| 18 | 🔲 Pending | — |
| 19 | 🔲 Pending | — |
| 20 | 🔲 Pending | — |
| 21 | 🔲 Pending | — |
| 22 | 🔲 Pending | — |
| 23 | 🔲 Pending | — |
| 24 | 🔲 Pending | — |
| 25 | 🔲 Pending | — |
| 26 | 🔲 Pending | — |
| 27 | 🔲 Pending | — |
| 28 | 🔲 Pending | — |
| 29 | 🔲 Pending | — |
| 30 | 🔲 Pending | — |
| 31 | 🔲 Pending | — |
| 32 | 🔲 Pending | — |
| 33 | 🔲 Pending | — |
| 34 | 🔲 Pending | — |
| 35 | 🔲 Pending | — |
| 36 | 🔲 Pending | — |
| 37 | 🔲 Pending | — |
| 38 | 🔲 Pending | — |
| 39 | 🔲 Pending | — |
| 40 | 🔲 Pending | — |
| 41 | 🔲 Pending | — |
| 42 | 🔲 Pending | — |
| 43 | 🔲 Pending | — |
| 44 | 🔲 Pending | — |
| 45 | 🔲 Pending | — |

---

## ORIGINAL HUMANIZER PROMPT

> You are a presentation narration editor. Your job is to make AI-generated narration sound human and natural.
>
> 1. **Identify AI patterns** — List 3-5 specific phrases or structures that sound robotic/corporate
> 2. **Rewrite for humanity** — Rewrite the entire narration to:
>    - Use contractions ("it's", "you'll", not "it is", "you will")
>    - Vary sentence length (mix short punchy sentences with longer ones)
>    - Do not use broken sentences, there should be continuity in the sentence that I can talk through
>    - Remove corporate filler ("leverage", "synergize", "robust")
>    - Add conversational markers ("here's the thing", "what's interesting is", "so basically")
>    - Use active voice where possible
>    - Include brief pauses (marked with "…")
> 3. **Output a comparison** — Show: Original section → Humanized section (side by side), why each change improves readability/naturalness
> 4. **Tone** — Write like you're explaining this to a colleague over coffee, not reading a corporate memo.

---

## PERSONA

- **Speaker:** Tech Lead presenting to their team/peers
- **Tone:** Personal, honest, a little funny, engaging
- **Voice:** Like explaining something over coffee to a smart colleague who was not there
- **NOT:** Corporate memo, TED talk trying too hard, scripted performance

---

## STYLE RULES (established through session)

### DO

- **Flowing connected sentences** — each sentence should connect naturally to the next; use em-dashes, commas, and connective words to link ideas
- **Audience questions** — start slides with questions that make the audience self-identify ("How many of you…", "Who here still…")
- **"I bet… most of us/you"** — consistent audience recognition beat
- **Pauses with "…"** — mark natural speaker beats
- **Active voice** — "we built" not "was built", "you own" not "ownership is transferred"
- **Full words for is not / are not** — use "is not" and "are not", not "isn't" and "aren't"
- **Personal admissions** — "That is on me", "I found them the hard way", "We did not plan it"
- **Specific details** — "user story, email, chat message, or someone's head" not just "various sources"
- **Short punchy closers after flowing paragraphs** — "That is why we built the spec process."

### DO NOT

- **Do not break sentences into small disconnected fragments** — "Stack. Auth. Data. Edges." is wrong; describe them in a flowing sentence
- **Do not use bumper-sticker phrases** — "Coder to conductor — that's the promotion" — too polished
- **Do not use essay-style signposting** — "Which brings us to act one", "Let me bring it home"
- **Do not use corporate vocabulary** — "leverage", "synergize", "actioned", "curates itself", "path of least resistance"
- **Do not start sentences with "And" as a paragraph opener** — feels like you walked in mid-conversation
- **Do not show the pain/struggle narrative** — focus on what was built and why, not the wall we hit
- **Do not reference Slack** — the team does not use Slack
- **Do not use any contractions** — "is not", "can not", "do not", "it is", "I am", "we are", "I have", never "isn't", "can't", "don't", "it's", "I'm", "we're", "I've"
- **Do not telegraph the structure** — "Watch them line up one to one" robs the ending of its punch

---

## KEY PATTERNS FIXED

| AI Pattern | Replaced With |
|---|---|
| "Coder to conductor — that's the promotion" | "It is less like coding and more like conducting" |
| "The window was simply empty" | "That moment just did not exist" |
| "The incentive did" | "The pain just moved earlier, and so did the thinking" |
| "Nobody enforced better specs" | "We never had to tell anyone" |
| "Five responsibilities, five walls" | Removed — too perfectly symmetric |
| Listing fragments ("Stack. Auth. Data.") | Full flowing description sentence |
| "Let me bring it home" | "Let me close it out" |
| "actioned" | "done" |
| "curates itself" | "takes care of itself" |

---

## WORKFLOW (session protocol)

1. I present narration for the next slide
2. User reviews and gives feedback or asks for changes
3. We iterate until the user says **"Love it"**
4. I update the file: [ai-assisted-development-story-narration-humanized.md](ai-assisted-development-story-narration-humanized.md)
5. Move to next slide

---

## STORY ARC (for continuity awareness)

| Slides | Theme |
|---|---|
| 1 | Opening: four things AI cannot take — Craft, Responsibility, Team, Judgment |
| 2 | The old process — audience recognition |
| 3 | What changed — reviewer replaced by AI |
| 4 | Five responsibilities that shifted |
| 6 | The matrix — five gaps, five systems |
| 7 | Plugin vs prompt library framing |
| 8–onward | Five discoveries: Spec → Trust → Continuity → Knowledge → Observability |

**Key threads to maintain:**
- "Are you sure?" — the human check that disappeared (introduced Slide 3, referenced in Slides 8–9)
- The four things AI cannot take (Slide 1) should pay off at the end
- "What is left for us?" — the central question, answered progressively
- Discovery framing: "five discoveries, each one unlocking the next"

---

## OUTPUT FILE

All locked narrations are saved to:
`docs/presentations/ai-assisted-development-story-narration-humanized.md`
