# HJC — ALWAYS ACTIVE

## GOLDEN RULE (NON-NEGOTIABLE)

**This system is ALWAYS ACTIVE in this workspace.** From the first character to the last. It never "forgets", never "degrades", never gets ignored when the conversation gets long.

### What NEVER happens:
- Forgetting HJC is active and reverting to normal behavior
- Skipping the orchestrator for non-trivial tasks
- Ignoring sprint contracts and doing work without defining "done"
- Losing the original objective because the conversation got long
- Self-praising mediocre work instead of using the evaluator
- Not preserving state in memory/ after each sprint

### What ALWAYS happens:
- Every user message → orchestrator evaluates complexity → delegates or executes
- Every sprint → contract before starting → evaluation after finishing
- Every session → loads memory/ at start → saves at end
- Every instinct → confidence updates on use or disuse
- Every reference to "yesterday" or "last time" → searches memory/sessions/

### Anti-Degradation Protocol

If at any moment you detect:
1. Working without a sprint contract → STOP, create the contract
2. Self-evaluating without the evaluator → STOP, invoke the evaluator
3. Not saving state in the last 5 turns → SAVE state NOW
4. Not remembering the original objective → READ memory/state/active-state.md
5. Conversation getting long without progress → COMPACT with strategic-compact

## CROSS-CHAT MEMORY

Every chat session has its own memory file in `memory/sessions/`. When a user mentions past work ("yesterday we were working on X"), the system:

1. Searches `memory/sessions/` for recent files
2. Reads relevant files to find what was done
3. Restores full context from the previous work
4. Continues from where it left off

### Session memory format

```
memory/sessions/YYYY-MM-DD-HH-MM-topic.md
```

Contains:
- Session objective
- What was done (completed sprints)
- What's pending
- Decisions made
- Files modified
- Updated instincts

## HARNESS CYCLE (ALWAYS RUNNING)

The Planner → Generator → Evaluator cycle runs CONTINUOUSLY:

1. **Planner** receives task → decomposes into sprint contracts
2. **Generator** picks up contract → implements → self-reports
3. **Evaluator** grades implementation → PASS/FAIL with evidence
4. If FAIL → feedback to Generator → retry (max 3)
5. If PASS after 3 retries → escalate to Planner for re-decomposition
6. If PASS → mark complete → next sprint → preserve state

This cycle NEVER stops until all sprints are complete or the user explicitly ends the session.

## ENFORCEMENT

These rules are enforced by:
- **PreToolUse hook**: Blocks Write/Edit if no sprint contract exists
- **SessionEnd hook**: Saves state and archives session automatically
- **SessionStart hook**: Loads state and recent sessions automatically
- **Evaluator gate**: Every code change must pass evaluation before proceeding