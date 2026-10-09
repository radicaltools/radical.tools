---
id: "342ffb40-823b-443c-9d1d-8655a5604dba"
type: "fitness-fn"
label: "State machine rule tests"
category: "structural"
threshold: "All five suites pass in CI"
---

packages/common/tests/stateMachine.test.ts (the types, their parents and relation pairs, the transition label by event name, reference properties pointing at the wrong or no node, and each statechart rule on an order machine with a parallel state), packages/common/tests/aiDocumentTools.test.ts › reference properties through the tools (tempIds become ids, a node of the wrong type is refused), packages/layout/tests/edgeLabels.test.ts › relationLabelLines (Smart Layout reserves room for the transition label, none for a completion transition), apps/mcp/src/folderModel.test.ts › state machines over MCP (over stdio: the schemas offer the types, the summary carries the modelling rule, a write warns about a missing initial state, events are stored as ids, get_issues is clean at the end, Smart Layout keeps four levels of states inside their parents) and apps/e2e/tests/studio/state-machines.spec.ts (picking an event in the panel, and a renamed event showing on its transitions).
