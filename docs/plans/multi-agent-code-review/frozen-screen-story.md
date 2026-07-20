# The Frozen Screen That Started a Conspiracy
### *One Dev. No Team. Just 50 AI Agents and a Grudge.*

---

## Act 1 — The Silence

Twenty minutes.

I'm sitting there running a static code review. No notification. No error. No progress bar. Just a cursor blinking at me like it has nothing to say.

Is it scanning? Did it fail? Did it finish and I missed it?

I have no idea.

This is what was happening under the hood:

```mermaid
graph LR
    Dev([Developer]) --> Agent[Single AI Agent]
    Agent --> F1[File 1]
    F1 --> F2[File 2]
    F2 --> F3[File 3]
    F3 --> FN[300+ files]
    FN --> STOP["⚠️ Silent Stop\nContext Window Full\nNo Error · No Warning"]

    style Dev fill:#228833,color:#fff
    style Agent fill:#2244bb,color:#fff
    style STOP fill:#cc2222,color:#fff
```

Static code review is supposed to be the safety net — the thing that catches what human eyes miss. The SQL injection buried three layers deep. The auth check missing on exactly the wrong endpoint. The hardcoded secret someone committed on a Tuesday and forgot about.

But a safety net with a hole you can't see is worse than no safety net. Because you trust it.

That twenty-minute nothing was the hole.

---

## Act 2 — The Wrong Fix

The obvious answer: scope it down. Give the AI less to read. Review one module at a time.

So I built it that way.

```mermaid
graph TD
    subgraph Scoped["Attempt 1 — Area-Scoped Review"]
        AgA[Agent: UserController] --> RA[Findings ✅]
        AgB[Agent: UserService] --> RB[Findings ✅]
        AgC[Agent: UserRepository] --> RC[Findings ✅]
    end

    subgraph Hidden["❌ Cross-Module Path — Invisible to All Agents"]
        UC[UserController\nUntrusted Input Enters] -->|no validation| US[UserService\nPasses It On]
        US -->|no validation| UR[UserRepository\nSQL Injection HERE]
    end

    style UC fill:#ff8800,color:#fff
    style US fill:#ff8800,color:#fff
    style UR fill:#cc2222,color:#fff
    style Hidden fill:#fff0f0,stroke:#cc2222
```

Then I tested it properly.

The most dangerous vulnerabilities don't live inside one module. They *travel*. A user types something into a form. It flows through a controller, into a service, down into a database query — and only at the very end does it become a SQL injection. If your reviewer only sees the controller, it sees data going out. If it only sees the database layer, it sees data arriving but has no idea it was ever untrusted.

The area-scoped approach had a blind spot exactly where blind spots are most dangerous — across module boundaries.

I scrapped it.

---

## Act 3 — The Real Question

I stopped asking *how do I make one reviewer smarter* and started asking *how would an expert actually do this?*

A senior security engineer doesn't read 500 files alone. They divide the work. Someone covers authentication. Another traces suspicious data flows. Someone else reviews API contracts. And then someone tries to actually break the system.

The context window was never the bug. It was a forcing function — pushing me toward the design that should have existed from the start.

---

## Act 4 — Building the Machine

### Step 1: Parallel Agents

What if instead of one AI reading everything, there were many — each reading a small slice, coordinated by something that sees the whole picture?

```mermaid
graph TD
    KG[(Knowledge Graph\ngraph-index.md)] --> AgA & AgB & AgC

    AgA["Agent: UserController\n12 checkers · parallel"]
    AgB["Agent: UserService\n12 checkers · parallel"]
    AgC["Agent: UserRepository\n12 checkers · parallel"]

    AgA --> MD[Merge + Dedup]
    AgB --> MD
    AgC --> MD

    MD --> Report[Combined Report]
    Report --> GAP["❌ Still blind to\ncross-module taint flows"]

    style KG fill:#225533,color:#fff
    style AgA fill:#2244bb,color:#fff
    style AgB fill:#2244bb,color:#fff
    style AgC fill:#2244bb,color:#fff
    style MD fill:#444444,color:#fff
    style GAP fill:#fff0f0,stroke:#cc2222,color:#cc2222
```

Better. No context exhaustion. Parallel. Fast.

But still missing something. Agents could see *within* their module. They still couldn't see *between* them.

---

### Step 2: The Taint Tracer

The agents needed a way to raise their hand — *"I saw something suspicious leave my module heading toward the database layer. I can't confirm it's dangerous. Someone should follow it."*

So I added Phase 2.5.

```mermaid
graph TD
    subgraph P1["Pass 1 — Module Agents · Parallel · Haiku"]
        MA[Agent: UserController] --> F1[Findings]
        MB[Agent: UserService] --> F2[Findings]
        MC[Agent: UserRepository] --> F3[Findings]
        MA --> SUP["⚠️ Suspect: untrusted input\nheading toward SQL layer"]
    end

    SUP --> TT

    subgraph TR["Phase 2.5 — Taint Tracer"]
        TT["Taint Tracer\nReads full call chain:\nUserCtrl → UserSvc → UserRepo\nDoes untrusted data reach SQL?"]
    end

    TT --> Conf["✅ Confirmed\nconfidence 0.85\nCross-module taint caught"]
    TT --> Ruled["❌ Ruled Out\nData sanitized en route"]

    style SUP fill:#ff8800,color:#fff
    style TT fill:#664499,color:#fff
    style Conf fill:#228822,color:#fff
    style Ruled fill:#666666,color:#fff
```

Now findings that crossed module boundaries could be confirmed — not just suspected.

---

### Step 3: The Specialist Personas

One finding can look different depending on who reviews it. A reliability engineer sees a resource leak. A concurrency specialist sees a race condition. An API reviewer sees a missing status code.

I added three specialist personas — running in parallel, each reading findings through a different lens.

```mermaid
graph TD
    AF[All Confirmed Findings] --> P1 & P2 & P3

    P1["P1 · Reliability Engineer\nNull paths · resource leaks\nexception handling · retry logic"]
    P2["P2 · Concurrency Specialist\nRace conditions · TOCTOU\nAsync void · deadlocks\n— self-skips if not applicable —"]
    P3["P3 · API Contract Reviewer\nMissing validation\nWrong status codes\nNo rate limiting on sensitive ops"]

    P1 --> V[validate · challenge · reduce-confidence]
    P2 --> V
    P3 --> V

    V --> RF["Reviewed Findings\n🔴 Conflicted — if any persona challenges\n✅ Dismissed — only if ALL three challenge"]

    style AF fill:#225533,color:#fff
    style P1 fill:#2244bb,color:#fff
    style P2 fill:#2244bb,color:#fff
    style P3 fill:#2244bb,color:#fff
    style RF fill:#334466,color:#fff
```

---

### Step 4: The Adversary

The last piece was the hardest to design.

All previous passes were looking for known patterns. But the most dangerous vulnerabilities aren't always in a checklist. Sometimes you need someone who isn't reviewing — someone who is *attacking*.

```mermaid
graph TD
    T{Runs when...} --> C1[Scope touches\nsecurity-critical modules]
    T --> C2[No ICEA found\nconservative default]
    T --> C3[ICEA contains auth\nor token keywords]
    T --> C4[--force-pass3 flag set]

    C1 & C2 & C3 & C4 --> AA["🔴 Adversarial Agent\nNot reviewing findings\nActively attacking the system"]

    AA --> AT1[Can I forge a token?]
    AA --> AT2[Can I access another user's data?]
    AA --> AT3[Can I escalate privileges?]
    AA --> AT4[Can I bypass the auth check?]
    AA --> AT5[Can I inject data that runs later?]

    AT1 & AT2 & AT3 & AT4 & AT5 --> NF["New Findings\nconfidence 0.70\npass 3"]

    style AA fill:#cc2222,color:#fff
    style T fill:#884400,color:#fff
    style NF fill:#884400,color:#fff
```

---

## Act 5 — The Final Architecture

All five phases together:

```mermaid
graph TD
    Dev([Developer]) -->|"/code-review --mode"| SKILL["SKILL.md\nPrerequisite check · Mode detection"]

    SKILL --> Ph1

    subgraph Ph1["Phase 1 — Scope"]
        SC["Scope Agent\nReads knowledge graph\nBuilds module list + security context"]
    end

    Ph1 --> Ph2

    subgraph Ph2["Phase 2 — Pass 1 · Parallel · Haiku"]
        MA1[Module Agent 1] & MA2[Module Agent 2] & MAN[Module Agent N] --> DD["Merge + Dedup\nfindings + suspects"]
    end

    Ph2 --> Ph25

    subgraph Ph25["Phase 2.5 — Taint Tracer · Parallel · Haiku · cap 50"]
        TT1[Tracer 1] & TT2[Tracer 2] & TTN[Tracer N] --> TC["Confirmed · Ruled Out · Deferred"]
    end

    Ph25 --> Ph3

    subgraph Ph3["Phase 3 — Pass 2 · Parallel · Sonnet"]
        PP1[P1 Reliability] & PP2[P2 Concurrency] & PP3[P3 API Contract]
    end

    Ph3 --> Ph4

    subgraph Ph4["Phase 4 — Pass 3 · Conditional · Sonnet"]
        AA[Adversarial Agent]
    end

    Ph4 --> Ph5

    subgraph Ph5["Phase 5 — Report · Sonnet"]
        RPT["Assembly Agent\nHTML Report · Ledger Merge"]
    end

    Ph5 --> O1[CodeReviews/report.html]
    Ph5 --> O2[code-review-ledger.md]
    Ph5 --> O3["partial.html — live in browser\n✅ Phase by phase · no silence"]

    style SKILL fill:#334db3,color:#fff
    style Ph1 fill:#e8f0ff,stroke:#334db3
    style Ph2 fill:#e8ffe8,stroke:#228833
    style Ph25 fill:#fffff0,stroke:#888800
    style Ph3 fill:#fff4e8,stroke:#884400
    style Ph4 fill:#fff0f0,stroke:#cc2222
    style Ph5 fill:#f4e8ff,stroke:#664499
    style AA fill:#cc2222,color:#fff
    style O3 fill:#228833,color:#fff
```

---

## Act 6 — Arguing With Myself

Six rounds of self-critique. Sixty issues. Alone.

**What if an agent times out?**
Count the failures. Abort cleanly if too many fail. No partial results passed off as complete.

**What if the cache serves a stale vulnerable result after I fix the bug?**
Every module gets a content hash computed from its source. Code changes, hash changes, cache misses. Automatic.

**How do I know the scan actually finished and didn't silently abort?**
Don't check if the file exists. Check its modification timestamp. A stale file from an earlier run shouldn't count as success.

**What about cross-module fingerprints — how do you track the same vulnerability across two files?**
The entry-side module assigns the fingerprint before knowing where the data lands. The tracer inherits it. The ledger sees one stable identity, not a new entry every time.

Every round the design got tighter. Every question made it more honest about what it knew and what it didn't.

---

## Act 7 — What Got Built

A 1,300-line design. An 800-line orchestration script. A four-layer testing strategy. One person.

But the real thing that got built isn't the code.

It's the answer to *what now?*

Now the scan runs in phases. You watch it happen — module by module, phase by phase, live in your browser. Findings traced across module boundaries. Specialists validating each other's work. An adversary looking for what the others missed.

No silence. No guessing. Nothing quietly quits halfway through and lets you believe you're safe.

The screen has something to say now.

---

*What silent failure in your stack are you trusting too much?*
