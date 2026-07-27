# The Control Plane You Never Built

**AI Agent Architecture · Observability · Control · Governance · Recovery**

*You deployed the AI. You trusted the output. You had no idea what was happening between those two events.*

---

## The Black Box

> **`?`**
>
> The agent was running. That's all I actually knew. Input went in, output came out, and somewhere in middle the context quietly ran out, the spec faded from the view, and the validation logic got... *improvised*.
> 
> *I had no visibility into anything between **send** and **receive**.*  

The artifact looked fine. It compiled. The method was there, right name, right signature. So I trusted it and moved on, the way anyone busy would.

What I couldn't see was everything it wasn't doing. No check for negative amounts. No upper bound enforced. No audit log entry. None of that was missing from the file's structure — the structure was perfect. It was missing from the logic inside it, written from pattern instead of spec. Invisible, until a production edge case two weeks later made it very visible.

I checked the logs afterward. Agent completed. Output returned. File on disk, right where it should be. Not one of those facts told me what happened during generation — when the spec started slipping out of frame, when the model was writing the last sections off whatever scraps it could still see. The logs told me the job finished. They didn't tell me it worked. Those turned out to be two different sentences.

```mermaid
graph LR
    Dev([Developer]) -->|"Prompt + spec"| BOX

    subgraph BOX["AI Agent — No External Visibility"]
        A1["Context fills with history"]
        A2["Spec details fade"]
        A3["Generation degrades"]
        A4["Artifact written"]
        A1 --> A2 --> A3 --> A4
    end

    BOX -->|"Output returned"| DEV2([Developer sees])
    DEV2 --> TRUST["✅ Looks right\nCompiles fine\nMethod is present"]
    TRUST --> SHIP["Ships to production\nTwo weeks later: silent wrong behavior"]

    style BOX fill:#1a3a5c,color:#cdd9e6
    style A2 fill:#ff8800,color:#fff
    style A3 fill:#cc2222,color:#fff
    style SHIP fill:#884400,color:#fff
```

In any other system, we'd call this a monitoring gap. In AI workflows, we call it Tuesday.

The artifact wasn't the problem. Nothing was watching — that was the problem. I'd deployed a data plane and called it a system.

---

## What a Control Plane Actually Is

We've solved this before. Just not for AI.

Modern software runs on two planes. The data plane is where the work happens — requests served, queries run. The control plane sits above it, mostly invisible, watching and governing without being part of the work itself.

- The load balancer doesn't know what your users want. It just knows server 3 is limping and quietly routes around it. 
- The circuit breaker doesn't understand your business logic — it knows the downstream service is failing and stops the bleeding before it cascades. 
- The gateway doesn't care what your service does; it knows this request has a bad token and rejects it before anything else sees it.  

None of these care about the content of the work. They govern the conditions it happens under.

```mermaid
graph TD
    subgraph TRAD["Traditional Software"]
        TCP["Control Plane\n────────────────\nLoad balancer\nCircuit breaker\nAPI gateway\nRate limiter\nHealth checks"]
        TDP["Data Plane\n────────────────\nRequests\nResponses\nQueries\nMessages"]
        TCP -->|"governs"| TDP
    end

    subgraph AI["AI Workflow"]
        ADP["Data Plane\n────────────────\nPrompts\nAgent sessions\nArtifact generation\nSession handoffs"]
        ACP["Control Plane\n────────────────\n???"]
        ACP -.->|"missing"| ADP
    end

    style TCP fill:#228833,color:#fff
    style ACP fill:#cc2222,color:#fff
    style ADP fill:#2244bb,color:#fff
    style TDP fill:#2244bb,color:#fff
```

Every item in that control-plane column exists because something broke catastrophically without it. We took those lessons seriously and built the missing layer, then called the result production-ready.

Then we handed the AI a task and a context window and said: good luck out there. No circuit breaker. Nothing watching, nothing able to step in.

That's not a workflow. That's a hope wearing a progress bar.

So I built the missing layer — **four pillars**, in the order I discovered I was missing them, which was usually right after something broke.

---

## Pillar 1: Observability

I'd love to say I had a dashboard, watching the token budget creep up, catching compaction before it ate my spec. Better lighting, that version.

The truth: `/context`, which tells you roughly what's in the window — qualitative, no hard numbers — and a `usage` field buried in the API response, if you remember to look. That was the whole layer. One fuzzy snapshot, one number you had to go dig for.

What I didn't have, and this is the part that actually bit me: any sense of how much of my spec was still *visible* to the model by the time it wrote the validation layer. No signal the task was drifting. No way to tell "generated" apart from "generated after compaction already ate half the instructions."

```mermaid
graph TD
    OBS["Observability Layer"] --> T1 & T2 & T3 & T4

    T1["Token Budget\n────────────────\nUsed: 142,500\nRemaining: 57,500\nThreshold: 160,000 (80%)\nStatus: ⚠️ Approaching ceiling"]
    T2["Task Progress\n────────────────\n[12/17] units complete\nCurrent: UserRepository\nLast completed: AuthHandler\nStalled: No (active)"]
    T3["Artifact State\n────────────────\nStatus: IN-PROGRESS\nSections: 2 of 4 validated\nPending: validation layer\nNext boundary: disk write"]
    T4["Session Health\n────────────────\nLast activity: 45s ago\nCompaction events: 1\nSpec visibility: PARTIAL\nRecommendation: ⚠️ Review before continuing"]

    OBS --> SURFACE["Signals surfaced to developer\nNot buried in agent logs\nVisible before the boundary is crossed"]

    style OBS fill:#664499,color:#fff
    style T1 fill:#ff8800,color:#fff
    style T4 fill:#ff8800,color:#fff
    style SURFACE fill:#228833,color:#fff
```

All four signals here — budget, progress, artifact state, session health — are knowable. None were surfaced to me when it mattered. Observability was never about knowing what went wrong. It's about knowing it's *about* to, while there's still a window to act.

---

## Pillar 2: Control

Knowing the budget just crossed 80% is useful. It's a lot less useful if the only thing you can do about it is worry.
 
A real circuit breaker doesn't log the failure and call it a day — it stops sending requests. An observability layer with no lever attached is just an expensive, well-lit way to watch a fire, fully informed and completely useless.
 
So when the control plane flags a problem, the answer can't be "log it." It has to put a real choice in front of the developer, with the tradeoffs, before anything gets written that can't be unwritten.

```mermaid
graph TD
    DETECT["Control Plane detects threshold breach\nToken budget: 57,500 remaining\nRequired for artifact: 32,000 tokens\nSpec visibility: PARTIAL after compaction\nRecommendation: intervene before continuing"]

    DETECT --> SURFACE["Intervention surface\nPresented before generation proceeds"]

    SURFACE --> OPT1["Option A — /compact\nFrees ~70k tokens\n⚠️ Risk: spec details now summarised\nEdge cases from earlier messages may be lost\nUse for: stale tool outputs, not live spec"]
    SURFACE --> OPT2["Option B — Fresh session\nFull 200k context restored\nSpec stated completely before generation\n✅ Safest path for artifact accuracy\nCost: re-establish context from checkpoint"]
    SURFACE --> OPT3["Option C — Split artifact\nGenerate section 1 of N now\nCheckpoint before next session\n✅ Keeps spec in context for today's work\nContinues accurately in next session"]

    OPT1 -->|"developer accepts risk"| GEN["Proceed — developer has made an informed choice"]
    OPT2 --> GEN
    OPT3 --> GEN

    style DETECT fill:#664499,color:#fff
    style OPT1 fill:#884400,color:#fff
    style OPT2 fill:#228833,color:#fff
    style OPT3 fill:#228833,color:#fff
    style GEN fill:#2244bb,color:#fff
```

The word doing all the work there is *informed*. The control plane can't make the call for you — it depends on things only you know. What it kills off is the option currently winning by default: no choice at all, generation just keeps going, and you find out it was wrong later, from someone else, at a worse time.
 
A circuit breaker that only logs the failure isn't a circuit breaker. It's a diary entry.

---

## Pillars 3 & 4: Governance and Recovery

### Governance — Nothing Crosses a Boundary Unverified

Here's what it feels like to cross a boundary unverified.   

The artifact's on disk, it compiles, tests pass on the happy path — you ship it. Two weeks later, a production edge case reveals the validation logic never existed. Not deleted. Never written. The spec had been compacted out of context before the model reached that section, and it filled the gap with pattern instead of your actual requirements. The artifact *looked* complete. It just wasn't.
 
Governance exists to stop that story. Not a courtesy check — a hard gate.

```mermaid
graph TD
    GEN["Agent output\n(generated artifact)"] --> B1

    subgraph B1["Boundary 1 — Artifact to Disk"]
        CHK1["Completeness audit\n────────────────────\nAll required sections present?\nSpecified edge cases implemented?\nNo truncation or pattern-fill at end?\nSpec was in context throughout?"]
    end

    CHK1 -->|"PASS"| DISK["✅ Write to disk\nArtifact verified complete\nProvenance logged"]
    CHK1 -->|"FAIL"| HALT["❌ Do not write\nReport: which check failed\nRegenerate with correction\nRe-audit before next attempt"]

    DISK --> B2

    subgraph B2["Boundary 2 — Session to Session"]
        CHK2["Checkpoint written\n────────────────────\nCompleted: files 1–8 ✅\nDecisions: eager validation, ErrorResponse type\nRemaining: files 9–17\nNext session starts at: UserRepository"]
    end

    CHK2 --> NEXT["Next session reads checkpoint\nResumes — does not restart\nSpec re-stated in full before continuing"]

    style CHK1 fill:#664499,color:#fff
    style CHK2 fill:#664499,color:#fff
    style DISK fill:#228833,color:#fff
    style HALT fill:#cc2222,color:#fff
    style NEXT fill:#228833,color:#fff
```

"It compiled" is not a governance check. "It was generated with the full spec still in context, and validated before anything got written" — that is. They sound close enough to fool you for two weeks.
 
### Recovery — Plan for Failure, Not Just Success

Most architectures are designed for success, because success is what you plan for — the artifact generates cleanly, the session ends without issue, the handoff is smooth. The recovery path is the one you skip because you genuinely don't expect to need it, right up until the moment you do.

And then you need it — because context exhausts mid-artifact, or compaction runs and compresses the spec detail that the next section depends on, or a section fails the governance gate and the question isn't whether to fix it but where to pick back up from. None of these are system crashes; they're just points where the session stopped, and the only question is whether you can continue from where it stopped or whether you're explaining everything from the beginning again.

```mermaid
graph LR
    S1["Session 1\nFiles 1–8\nBudget healthy"] -->|"approaching 80% threshold"| CP1

    CP1["Checkpoint\n────────────────────\nCompleted: auth layer\nDecisions: eager validation\nRemaining: core domain, data layer\nNext: UserRepository line 1"]

    CP1 --> S2["Session 2\nReads checkpoint\nContinues from UserRepository\nFull context for remaining scope"]

    S2 -->|"approaching threshold"| CP2["Checkpoint\nCompleted: auth + core\nRemaining: data layer"]

    CP2 --> S3["Session 3\nCompletes data layer\nAll 17 files done\n✅ No restarts · No re-explanations"]

    style CP1 fill:#664499,color:#fff
    style CP2 fill:#664499,color:#fff
    style S3 fill:#228833,color:#fff
```

The checkpoint gets written before the context fills up, not after — after is a nice idea and also useless — structured so a fresh session can read it cold and know what was decided, what's done, and where to pick the thread back up.

---

## The Complete Control Plane

All four pillars together — one layer, sitting above every AI agent session, governing everything that crosses a boundary.

```mermaid
graph TD
    Dev([Developer]) --> CP

    subgraph CP["AI Control Plane"]
        OBS["Observability\n────────────────────\nToken budget · Task progress\nArtifact state · Session health\nSurfaces signals continuously"]

        CTRL["Control\n────────────────────\nThreshold detection\nIntervention surface\nInformed developer choice\nCompact · Fresh · Split"]

        GOV["Governance\n────────────────────\nCompleteness audit\nBoundary enforcement\nNo unverified artifact reaches disk\nNo unverified session crosses over"]

        REC["Recovery\n────────────────────\nCheckpoint writer\nSession reader\nResume not restart\nExplicit handoff at every boundary"]

        OBS --> CTRL --> GOV --> REC
    end

    CP --> S1 & S2 & SN

    S1["Agent Session 1\nBounded scope\nMonitored throughout"]
    S2["Agent Session 2\nResumes from checkpoint\nFull context for its scope"]
    SN["Agent Session N\nCompletes remaining scope\nVerified before write"]

    S1 & S2 & SN --> AUDIT["Completeness audit\nbefore every boundary crossing"]
    AUDIT -->|"PASS"| OUT["Output\nVerified · Provenance tracked\nArtifact on disk or handed off"]
    AUDIT -->|"FAIL"| RECOVERY["Recovery path\nCheckpoint read · Corrected · Re-audited"]
    RECOVERY --> CP

    style CP fill:#0d1f35,color:#cdd9e6
    style OBS fill:#664499,color:#fff
    style CTRL fill:#884400,color:#fff
    style GOV fill:#225533,color:#fff
    style REC fill:#2244bb,color:#fff
    style AUDIT fill:#664499,color:#fff
    style OUT fill:#228833,color:#fff
    style RECOVERY fill:#cc2222,color:#fff
```

Nothing reaches the output without passing through all four layers, which means the system can still fail — but when it does, it fails with a recovery path rather than a silent artifact. The developer always knows where things stand because the observability layer is always running, always has a choice when things go sideways because the control layer surfaces one, and never has to discover a broken artifact in production because the governance layer won't let an unverified one reach disk. And when a session ends before the work is done, the next one picks up exactly where it left off because the recovery layer wrote it down.

I showed this to a colleague. She looked at it for a moment and said: "This is just software engineering." She was right. We'd just never thought to apply it to AI.

---

## Act 7 — Arguing With Myself

Five objections — all of them ones I raised myself before building this.

---

**This is a lot of infrastructure for a workflow that mostly works fine.**

I know, that's exactly what I said — and then I remembered that the corrupt artifact which compiled correctly and failed silently also "mostly worked fine," passing every test on the happy path. The control plane doesn't exist for the majority of sessions where nothing goes wrong; it exists for the minority where something does, and ensures that when it does, the failure is visible and recoverable rather than silent and trusted.

---

**The developer still has to make the intervention choices. Doesn't this just add friction?**

That was my second objection too, and what I realized is that the friction already exists — right now it shows up two weeks later in production, with no context about what went wrong or where. The control plane moves that friction earlier, when it's cheap and when you have actual information about what you're choosing. What it eliminates is the option that currently dominates: no choice, no surface, generation continues, artifact writes, problem discovered downstream.

---

**What about small tasks where context exhaustion will never happen?**

For small tasks, the control plane is lightweight by design — the budget check passes trivially, the completeness audit takes seconds, the checkpoint is a paragraph — because the overhead scales with risk, not with task size, and the system is built to get out of your way when it doesn't need to be in it.

---

**Checkpointing adds state to manage across sessions. That's complexity.**

Here's the thing: you already have state across sessions — it's just implicit right now, living in the conversation history the model compressed, in the decisions you vaguely remember making, in the context you'll need to re-explain when you start again tomorrow. The checkpoint makes that implicit state explicit, and explicit state is manageable while implicit state is why the validation layer got approximated and nobody noticed for two weeks.

---

**How is this different from just being more careful?**

Being more careful is a habit, and a control plane is a system, and the difference is that habits degrade under pressure, time constraints, context switches, and the very human tendency to trust a result that looks right — while systems don't forget to run the completeness audit because it's late, and don't skip the checkpoint because the session is almost done anyway.

---

## Act 8 — What the Layer Changes

| | |
|---|---|
| **4** | Pillars: Observability · Control · Governance · Recovery |
| **0** | Artifacts reaching disk without a completeness audit |
| **0** | Sessions resuming without reading a checkpoint |
| **1** | Question before every generation: what does the observability layer say? |
| **∞** | Gap between "it compiled" and "it was verified" |

The control plane doesn't make the AI smarter. It makes the AI's work verifiable — before it crosses a boundary, before it reaches disk, before it's relied on by code that assumes it's correct.

The corrupt artifact was not a bug in the model, which did exactly what it was trained to do: produce a coherent response from the context it had. The failure was in the layer above it — or rather, in the absence of that layer — because there was no observability to surface the degrading context, no control to offer an intervention before the boundary, no governance to catch the incomplete output before it was written, and no recovery to resume from a known-good state. The model was blameless. The architecture wasn't.

> **Every AI workflow has a data plane.** The work happens somewhere. What most AI workflows don't have is the layer that watches, intervenes, validates, and recovers. Without it, you're trusting the output because it looks right — not because anything verified it was.
>
> *What does your AI control plane look like — and if you don't have one, what are you trusting instead?*

---

*AI Agent Architecture · Observability · Control · Governance · Recovery · 2026*
