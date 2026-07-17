# LangGraph Orchestrator — Future Implementation Plan

**Status:** Future phase — implement after Workflow version stabilizes  
**Prerequisite:** Multi-agent code review (Workflow version) in production and stable  
**Date:** 2026-07-16

---

## Why LangGraph

The Workflow tool (Claude Code) is the default orchestrator. It provides deep
Claude Code integration, a progress display, and zero setup for interactive use.

LangGraph is the CI/CD orchestrator for headless environments. Key advantages:
- **Streaming:** `astream_events()` yields results as each node completes (true incremental)
- **Checkpointing:** automatic resume from last completed node after failure
- **No Claude Code dependency:** runs in any CI/CD environment without the CLI
- **No concurrency cap:** not limited to `min(16, cpu_cores - 2)` — configurable
- **Model-agnostic:** swap Claude for any LLM without changing graph structure

Both orchestrators share the same prompts, schema, dedup logic, and report format.
Only the fan-out mechanism changes.

---

## Architecture Mapping

| Workflow concept | LangGraph equivalent |
|---|---|
| `phase()` | Named node group |
| `parallel([...])` | `Send()` API — true dynamic fan-out |
| `agent(prompt, schema)` | Node calling Anthropic SDK with structured output |
| `pipeline()` | Chained nodes passing state |
| `log()` | `astream_events()` handler writing to stdout/file |
| Resume from `--continue` | `MemorySaver` / `PostgresSaver` checkpointer |

---

## Shared Module Layer (must exist before LangGraph implementation)

All orchestration-agnostic logic must be extracted before building the LangGraph runner:

```
skills/code-review/shared/
  prompts.js          # buildPass1Prompt(module), buildPersonaPrompt(persona, findings),
                      # buildTracerPrompt(suspect, callChainFiles), buildAdversarialPrompt(...)
  schema.js           # FINDINGS_SCHEMA, SUSPECTED_TAINT_SCHEMA, LEDGER_SCHEMA (JSON Schema)
  dedup.js            # fingerprint(file, fn, line, checker)
                      # mergeRuleA(existing, incoming)        — Pass 1 agent merge
                      # mergeRuleB(existing, tracerOutput)   — tracer upgrade
                      # detectDedupCollision(existing, incoming) — differing evidence
  report.js           # buildHTMLReport(findings, ledger, coverageData)
                      # updateLedger(oldLedger, newFindings, scanScope)
  checkers.js         # CHECKERS_PASS1, CHECKERS_PASS3, getDomainCheckers(profile)
```

The LangGraph runner imports these directly. Prompts and schema never live inside
either runner.

---

## LangGraph Graph Structure

```python
from langgraph.graph import StateGraph, START, END
from langgraph.constants import Send
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated
import operator

class ReviewState(TypedDict):
    modules:        list[dict]
    suspects:       list[dict]   # suspected_taint[] from Pass 1
    findings:       Annotated[list[dict], operator.add]   # append-only
    ledger:         list[dict]
    scanScope:      list[str]
    failures:       Annotated[list[dict], operator.add]
    phase:          str
    abort:          bool

def build_graph():
    graph = StateGraph(ReviewState)

    graph.add_node("scope",       scope_node)
    graph.add_node("pass1",       pass1_node)
    graph.add_node("dedup_1",     dedup_pass1_node)
    graph.add_node("tracer",      tracer_node)
    graph.add_node("dedup_2",     dedup_tracer_node)
    graph.add_node("supervisor",  supervisor_node)   # fail-fast checks
    graph.add_node("persona_p1",  persona_p1_node)
    graph.add_node("persona_p2",  persona_p2_node)   # self-skipping
    graph.add_node("persona_p3",  persona_p3_node)
    graph.add_node("adversarial", adversarial_node)
    graph.add_node("report",      report_node)

    graph.add_edge(START, "scope")
    graph.add_conditional_edges("scope",   fan_out_modules, ["pass1"])
    graph.add_edge("pass1",  "dedup_1")
    graph.add_edge("dedup_1", "supervisor")
    graph.add_conditional_edges("supervisor", check_abort_or_continue,
        {"continue": "tracer", "abort": "report"})
    graph.add_conditional_edges("dedup_1", fan_out_tracers, ["tracer"])
    graph.add_edge("tracer", "dedup_2")
    graph.add_edge("dedup_2", "persona_p1")
    graph.add_edge("dedup_2", "persona_p2")
    graph.add_edge("dedup_2", "persona_p3")
    graph.add_edge(["persona_p1", "persona_p2", "persona_p3"], "adversarial")
    graph.add_edge("adversarial", "report")
    graph.add_edge("report", END)

    return graph.compile(checkpointer=MemorySaver())

def fan_out_modules(state):
    return [Send("pass1", {"module": m}) for m in state["modules"]]

def fan_out_tracers(state):
    suspects = state["suspects"][:50]   # cap at 50 — remainder deferred to --continue
    return [Send("tracer", {"suspect": s}) for s in suspects]
```

---

## Streaming Implementation

```python
async def run_with_streaming(initial_state, run_id: str):
    graph  = build_graph()
    stream = open(".code-review/stream.jsonl", "w")
    html   = open(".code-review/partial.html",  "w")

    async for event in graph.astream_events(
        initial_state,
        config={"configurable": {"thread_id": run_id}},
        version="v2"
    ):
        if event["event"] == "on_chain_end":
            node_name = event.get("name", "")

            if node_name == "pass1":
                findings = event["data"]["output"].get("findings", [])
                mod_id   = event["data"]["input"]["module"]["moduleId"]
                stream.write(json.dumps({"type": "module_complete",
                    "module": mod_id, "findings": findings}) + "\n")
                stream.flush()
                update_partial_html(html, findings)
                print(f"✓ {mod_id}: {len(findings)} findings")

            elif node_name == "tracer":
                action = event["data"]["output"].get("action")
                fp     = event["data"]["output"].get("fingerprint")
                print(f"{'✓ confirmed' if action == 'upgrade' else '✗ ruled out'}: {fp}")

            elif node_name in ("persona_p1", "persona_p2", "persona_p3"):
                print(f"✓ {node_name} complete")

    stream.close()
    html.close()
```

---

## Checkpointing and Resume

```python
# Run 1 (fails or times out at 18 min)
await graph.ainvoke(initial_state,
    config={"configurable": {"thread_id": "run-2026-07-16"}})

# Resume — LangGraph replays completed nodes from checkpoint; only runs pending nodes
await graph.ainvoke(None,
    config={"configurable": {"thread_id": "run-2026-07-16"}})
```

For CI/CD persistence across sessions (state survives process restarts):
```python
from langgraph.checkpoint.postgres import PostgresSaver
checkpointer = PostgresSaver.from_conn_string(os.environ["POSTGRES_URL"])
graph = build_graph_with_checkpointer(checkpointer)
```

---

## Failure Handling

```python
from langgraph.pregel import RetryPolicy

# Node-level retry
graph.add_node("pass1", pass1_node, retry=RetryPolicy(
    max_attempts=2,
    retry_on=lambda e: isinstance(e, (TimeoutError, SchemaValidationError))
))

# Supervisor node — fail-fast after each phase
def supervisor_node(state: ReviewState):
    failures = state.get("failures", [])
    phase_failures = [f for f in failures if f["phase"] == state["phase"]]
    phase_total    = state.get("total_agents_this_phase", 1)

    if len(phase_failures) / phase_total > 0.30:
        return {"abort": True,
                "reason": f">30% failures in phase {state['phase']}"}
    if len(failures) > 3:
        return {"abort": True, "reason": "Total failure threshold (>3) exceeded"}
    return {}
```

---

## Dependencies

```
# Python
langgraph>=0.2.0
langchain-anthropic>=0.2.0
langchain-core>=0.3.0
anthropic>=0.28.0
psycopg2-binary>=2.9.0    # optional — PostgresSaver only
```

---

## CLI Integration

```bash
# Interactive (Claude Code) — Workflow runner (default)
code-review --scope full

# CI/CD headless — LangGraph runner
CODE_REVIEW_ORCHESTRATOR=langgraph code-review --scope full

# Resume a failed LangGraph run
CODE_REVIEW_ORCHESTRATOR=langgraph code-review --continue --run-id run-2026-07-16

# Incremental — scope limited, deferring large codebases
CODE_REVIEW_ORCHESTRATOR=langgraph code-review --scope 20 --continue
```

---

## What Must Not Change Between Orchestrators

The following are owned by `shared/` and must never be duplicated in either runner:

- Findings schema (all fields, types, constraints)
- Fingerprint key algorithm (`hash(file:function:line:checker)`)
- Merge Rule A (Pass 1 agent merge) and Rule B (tracer upgrade)
- Ledger format and all merge scenarios
- Checker taxonomy (12 MVP + domain profiles)
- Report HTML section structure and finding card format
- Coverage tracking and gap reporting format
- Confidence defaults by source (0.95 / 0.85 / 0.30 / 0.80 / 0.70)

---

## Migration Phases

| Phase | What | When |
|---|---|---|
| 1 — Current | Workflow-only; all logic inline | Now |
| 2 — Refactor | Extract `shared/` modules; Workflow imports them | After first successful review run |
| 3 — LangGraph | Implement `code-review.graph.py` using `shared/` | CI/CD integration becomes a requirement |
| 4 — Config | Add orchestrator selection via env var / config | After LangGraph is tested |
| 5 — Both stable | Keep both — Workflow for interactive, LangGraph for CI/CD | Long-term |

**Critical:** Do NOT implement LangGraph before Phase 2 (shared module extraction) is complete.
Implementing two runners against unextracted code means maintaining two copies of
prompts and schema — the opposite of what decoupling should achieve.

---

## References

- Multi-agent code review architecture: `docs/plans/multi-agent-code-review-with-graph.md`
- Workflow runner source: `skills/code-review/runners/workflow/code-review.workflow.js`
- Shared modules: `skills/code-review/shared/`
- LangGraph docs: https://langchain-ai.github.io/langgraph/
