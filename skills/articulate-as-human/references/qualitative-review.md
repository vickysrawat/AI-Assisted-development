# Qualitative Review Guide (secondary pass)

The script catches exact phrases and measurable density. It cannot catch a
sentence that inflates an ordinary fact without using any watched word, or
a paragraph that's mechanically three-part without ever writing "firstly."
That's what this pass is for. Read the document once, straight through,
after the script has run — this is not a replacement for the script, it's
what happens after.

Mark findings the same way the script does: location + pattern + why it
reads as generic. Do not rewrite anything during this pass. That still only
happens on request (see SKILL.md step 4).

## Categories to look for

**1. Staging instead of stating.** A sentence spends its words signaling
that something matters rather than saying what it is. Two forms show up a
lot: a contrast built just to add weight ("It's not just a policy update —
it changes how the team works day to day" where the second half doesn't
actually add new information), and a closing line that repeats the
paragraph's point instead of adding to it. The regex catches the exact
"not just X, it's Y" wording; this pass catches the same move spread across
two full sentences or dressed in different words.

**2. Rhythm and structure applied by rule, not by need.** Three-part lists,
three-example paragraphs, or the same section shape repeated across the
whole document regardless of whether each section actually has three
things to say. The tell isn't the number three — it's the same shape
recurring on a schedule rather than because the content called for it.

**3. Inflation and borrowed weight.** An ordinary fact described as
pivotal, foundational, or industry-defining, or a claim that leans on
implied authority without naming a source — this can happen without any of
the literal phrases the script watches for ("experts agree," etc.). Ask: if
I removed the adjective, would the sentence lose any actual information?
If not, the adjective is doing the AI's job, not the writer's.

**4. Formatting applied uniformly.** Bold or title case used on every list
item or every key term regardless of whether that item needs the emphasis.
The script only flags 3+ consecutive bold-lead-in bullets; this pass covers
the same habit spread across non-consecutive lines, headers, or a whole
document's heading style.

**5. Leftovers from the drafting process.** Anything that reads like it was
meant for the chat, not the reader: meta-commentary about the writing
itself ("here's a revised version that addresses your feedback"),
disclaimers that don't belong in a final deliverable, or a sign-off that
assumes a conversational back-and-forth rather than a document that stands
on its own.

**6. Absence of a specific voice — read this one with judgment.** No
opinion, no acknowledged tension, no concrete detail that only applies to
this document and no other. This is the one category where "fix it" isn't
always right: a legal memo, a structured status report, or anything with a
defined format (a fixed status taxonomy, a citation-integrity report,
etc.) is *supposed* to stay neutral and formatted. Flag flatness as an
observation, not automatically as a defect — whether it needs fixing
depends on what kind of document this is.

## Judgment calls, not automatic flags

- A single instance of any category above, on its own, is often nothing —
  writers make these same choices on purpose. Treat one isolated hit as
  worth noting only when a few of these categories show up together in the
  same passage. That combination is the actual signal.
- If the flagged phrase sits inside a quotation, a proper name, a title, or
  a passage that's specifically discussing the phrase rather than using it,
  it's not a hit. Don't flag "seamless" inside a quoted client requirement.
- Text that predates this document's own creation (boilerplate carried over
  from an older template, a quoted RFP requirement, contractual language)
  isn't a target for this check at all — it's not AI-generated and
  shouldn't be rewritten to sound more casual.

## If a rewrite is requested after this pass

Follow the same no-fabrication rule as the script's own workflow: never add
a fact, name, number, date, citation, or claim that isn't already in the
source text or supplied by the user. If fixing a flagged sentence would
require a detail that isn't there, ask for it or simplify the sentence
instead of inventing one. Preserve every structural contract the document
already follows (status taxonomy, citation markers, required headers) —
this pass fixes prose, not structure.
