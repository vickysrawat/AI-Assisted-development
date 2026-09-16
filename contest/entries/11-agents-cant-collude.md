# Entry 11 — The Two Agents That Can't Collude

> The one where "we won't leak your code" stops being a promise you have to trust and becomes a wall
> the system physically cannot climb.
> Category: Responsible AI + Creativity · Status: READY (bonus)
> Numbers pulled from `../measured-claims.md` and labeled honestly; demo in `../demo-scripts.md` §Entry 11.

---

## 1. The pitch, in one breath

To tailor your data-sensitivity rules to your actual industry, something needs to research regulations
on the web *and* something needs to read your proprietary code. This splits that across two agents wired
so that the one on the internet can't see your files, and the one reading your files can't reach the
internet, so leaking your source isn't *against the rules*, it's simply impossible.

## 2. Why it exists

Here's the uncomfortable shape of the problem. Making the sensitivity rules fit *your* domain needs two
capabilities that are dangerous in the same hands: reaching the internet, and reading your source. Put
both in one agent and you've built, by definition, an exfiltration risk: one prompt-injection or one
confused step away from pasting your schema into a search query.

Almost everyone "solves" this with a *policy* ("the assistant won't send code externally") which is a
promise the model can break, and which you have to take on faith. That felt wrong. So the fix here isn't
a promise; it's the architecture. This is for the security- and privacy-conscious teams (legal,
healthcare, fintech, government) who need regulation-aware AI and a *guarantee* that regulation-aware
never means source-leaking.

## 3. What actually works today

When the plugin grounds your project's sensitivity policy in real regulatory frameworks, it spins up two
separate agents with deliberately non-overlapping tools:

- **The researcher** can search and fetch from the web, and has **no ability to read your files at
  all.** It's handed only two things: your domain and your jurisdiction.
- **The synthesizer** can read your architecture and code, and has **no network access whatsoever.** It
  takes the researcher's cited findings and maps them onto your actual system to draft the rules.

The output carries citations and a retrieval date, waits for your explicit `APPROVED` before it's
written, and if the network's unavailable it says so plainly rather than quietly guessing.

## 4. Who does what (and why neither can betray you)

- **The researcher** learns the regulations from just a domain and a jurisdiction. It can't leak your
  code because it was never allowed to see it.
- **The synthesizer** reads your code to apply those regulations, but it can't phone home, because it
  has no phone.
- **The guarantee lives in the wiring, not the model:** to send your source to the web, one agent would
  need both file access and a network connection. Neither has both. There's nothing to enforce at
  runtime because the dangerous state doesn't exist.
- **You** confirm the domain and give the final approval.

## 5. How a policy gets grounded

1. Confirm your domain and jurisdiction (one question). **You confirm.**
2. The researcher goes to the web with *only* those two facts and comes back with cited regulatory
   categories. (It never saw your code.)
3. The synthesizer combines those cited facts with your architecture to draft the sensitivity rules. (It
   can read your code, but it can't send anything anywhere.)
4. You review the full draft and it's written only on the exact word `APPROVED`.

## 6. What it's worth (told straight, labeled straight)

The heart of it is verifiable: the researcher's toolset is web-only, the synthesizer's is files-only.
That's a real capability constraint you can check in their definitions, not a description of intended
behavior. And the only thing that ever crosses to the internet is a domain label and a jurisdiction,
never a line of code. The rules that come back are cited, dated, and human-approved before they're
written. *(measured: the two agents' tool sets are exactly these.)*

What I won't overstate: whether the grounding is as accurate as a compliance lawyer's review. That's
**not-yet-evaluated**; it's best-effort and human-checked, and I'd rather say so than imply a rigor I
haven't tested.

## 7. Why it sticks with you

One line carries it: **"privacy here isn't a promise, it's physics."** It's the two-key nuclear launch
applied to AI tooling, and the elegance is that the safety property just falls out of how the tools are
wired. Nothing to trust, nothing to audit at runtime, nothing a clever prompt can talk its way around.

In a field where "we take your privacy seriously" is a punchline, a guarantee you can reason about
straight from the two tool definitions is a different kind of claim.


## 8. The responsible-AI part

- Exfiltration-resistant *by construction*: capability separation, not a policy the model could
  violate. It's the strongest possible answer to "will this send my code somewhere?"
- Least privilege, literally: each agent gets only the tools its job needs.
- Human-gated and cited: approval before any write, a source for every rule; locked domains (like
  legal) are copied byte-for-byte and only appended to, never rewritten.
- **Where your data goes:** the researcher's queries carry only your domain and jurisdiction to the web,
  by design; your source never leaves via it, because it never had it.
- **Runs on Claude Code:** this is a Claude Code plugin; the two subagents are spawned via the Claude
  Agent SDK, so it won't run as-is on GitHub Copilot, Cursor, or any other agent. The *idea*
  (capability-airgapped agents) ports to any framework with per-agent tool scoping; this
  *implementation* doesn't.
- **The honest caveat:** the grounding is best-effort and human-reviewed, and its accuracy against an
  expert's read is not yet measured.

## 9. The demo (and the backup)

Full script in `../demo-scripts.md` §Entry 11 (2 minutes). The shape: run `SET DOMAIN` → confirm domain
and jurisdiction → show the researcher's spawn carries *only* those two facts and has no file tools →
show the synthesizer has file tools but no network → the cited rules draft appears → `APPROVED` writes
the policy. Deliver the line: "to leak your code, one agent would need both file access and a network,
neither has both." **Backup:** the two tool-set definitions side by side and a sample policy with
citations.

---

## How it scores (my honest self-check, 1–5)

- **Practical value — 4.** A regulation-aware sensitivity policy with a hard privacy guarantee attached.
- **Working solution & use of AI — 5.** Real disjoint-capability agents; the researcher/synthesizer split is the whole design.
- **Resourcefulness — 4.** The safety just falls out of the tool wiring — nothing to enforce at runtime.
- **Creativity & fun — 5.** "Privacy is physics" — a two-key-launch design for AI.
- **Clear story & readiness — 4.** Nine answers, a demo, a backup.
- **Responsible AI — 5.** Exfiltration impossible by construction, least privilege, cited and human-gated.

Nothing below a 4 → **READY.**
