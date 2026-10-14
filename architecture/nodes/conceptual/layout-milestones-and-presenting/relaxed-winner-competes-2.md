---
id: "bbf96d1d-e59e-4400-addd-415a53053cde"
type: "requirement"
label: "Relaxed winner competes"
action: "Smart Layout shall also score the layout the live physics makes of its winner, in Studio and in the MCP server alike, and return it only when it scores better than the winner."
ears_type: "optional"
feature: "the diagram being laid out has fewer than 150 visible elements"
rationale: "The physics improves layouts the engines spread too wide and worsens most C4 layouts; scored as a candidate, it can only help. Evidence: packages/layout/src/smartLayout.ts (relaxedCandidate); packages/layout/src/liveColaEngine.ts (relaxLayout); packages/layout/tests/smartLayout.test.ts; manual#layout"
---
