# Entry 5 — The Architect

> The one where you point an AI at a codebase nobody documented, and it hands back honest, living
> architecture docs (diagrams and all) with the gaps marked instead of guessed.
> Category: Practical value · Status: READY
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 5.

---

## 1. The pitch, in one breath

Most codebases have no current architecture docs, or docs that went stale the week after someone
wrote them. Point the Architect at the code and it writes them for you, from what the code actually
says, diagrams included; and everywhere it *can't* tell, it writes a visible "⚠ needs input" instead
of making something up.

## 2. Why it exists

Two kinds of people need a map of a system, and both are usually left without one: the human joining
the team who has to learn it, and the AI tooling that has to reason about it. Hand-written docs never
keep up with the code, so they quietly drift into fiction.

And the "easy" fix makes it worse. Ask an AI to "document the architecture" and it will happily invent
an SLA, a rationale for a decision nobody remembers making, a data flow that doesn't exist, all in the
same confident tone as the true bits. The point of this skill is the discipline that most AI doc
generators lack: it documents what the code *proves*, and it says "I don't know" out loud everywhere
else. This is for anyone inheriting an unfamiliar or legacy codebase who needs a map they can *trust*.

## 3. What actually works today

It detects your stack (a dozen-plus of them: .NET, Angular, React, Spring, the Python frameworks,
even VSTO add-ins) and produces a tailored eight-document set, composed from a shared base plus a
stack-specific overlay. The centerpiece, `architecture.md`, carries two real Mermaid diagrams, an
end-to-end view and a layered one, drawn from the actual code.

The deployment doc is different on purpose: it comes from a short questionnaire (hosting, CI/CD,
secrets, rollback, auth, the non-functional targets) and it isn't written until you review the draft
and type the exact word `APPROVED`.

## 4. Who does what (the AI, the machinery, and you)

- **The AI** reads the code, classifies the modules, writes the sections and the diagrams, and drafts
  the deployment context from your answers.
- **The machinery** detects the stack, deploys the templates, and runs a three-signal check that
  refuses to overwrite a doc that already has real content in it.
- **You** answer the deployment questions, give the exact-word approval, and fill the "⚠" gaps the
  code couldn't reveal. It runs on your local codebase; nothing leaves the environment.

## 5. How the docs come to life

1. Detect the stack, lay down the template set (only the files that are missing).
2. Ask the deployment questions in one pass, show you the draft, and write **nothing** until you say
   `APPROVED`.
3. Populate the code-derived docs and diagrams, flagging every gap with "⚠".
4. Hand the structural graph off to `/graph-sync` and get out of your way.

## 6. What it's worth (told straight, labeled straight)

The value that compounds is **write-once, read-many**: this one doc set becomes the shared ground truth
that the spec skill, the security scan, the readiness assessment, and the explainer all read from.
Generate it once; everything downstream benefits. *(measured — those skills read `.claude/architecture/`.)*

And it **never fabricates**: gaps become "⚠" markers, the decisions log is seeded but never
invented, a diagram is never emitted broken or empty. It's also non-destructive: it won't clobber a doc
you've already filled in. *(measured: these are hard rules in the skill.)*

Whether it actually shortens onboarding, which is the dream, I haven't measured, so that's
**not-yet-evaluated**.

## 7. Why it sticks with you

Two scrolls tell the whole story. First a clean, rendered architecture diagram: *it drew that from code
it had never seen until thirty seconds ago.* Then, a little further down, a bold "⚠ needs input" where
*it refused to guess.* Competence and humility in the same scroll; and a tool that's honest about what
it can't see is the one you can trust on the parts it says it can.

## 8. The responsible-AI part

- You own the operational truth: the deployment doc waits for the exact word `APPROVED`, and edits
  round-trip before anything is written.
- It never invents rationale, SLAs, or NFR targets — those become "⚠", never fiction.
- It never overwrites your real content or your hand-kept decision log.
- **Where your data goes:** it reads your local code (announcing source reads first); nothing leaves
  the environment except the calls you initiate.
- **Runs on Claude Code:** this is a Claude Code plugin; its skills, hooks, and slash commands are
  Claude-Code-native, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  here ports to other tools; this *implementation* doesn't.
- **The honest caveat:** module-type classification is a judgment call that sharpens over time, and the
  "⚠" gaps are homework it's leaving *you*, deliberately.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 5 (2 minutes). The shape: run it on an undocumented repo →
answer the short deployment questionnaire → watch `.claude/architecture/` fill in → open the two
Mermaid diagrams → scroll to a "⚠" and say the line ("it never fabricates"). **Backup:** a
pre-generated architecture set with diagrams.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 5.** An accurate baseline for both humans and the whole AI workflow.
- **Working solution & use of AI — 4.** Detection and deploy deterministic; the writing is AI; the deployment truth is yours.
- **Resourcefulness — 4.** Composed templates (one base, many stacks); one pass even scaffolds sibling projects.
- **Creativity & fun — 4.** Diagrams from never-seen code, and visible honesty where it can't tell.
- **Clear story & readiness — 5.** Nine answers, a tight demo, a backup.
- **Responsible AI — 5.** Exact-word approval, never-fabricate, non-destructive, consent-announced reads.

Nothing below a 4 → **READY.**
