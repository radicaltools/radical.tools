---
id: "ba79f913-57e2-4f3d-a04f-9915945b9ed4"
type: "fitness-fn"
label: "Preset fork on edit"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/aiDocumentTools.test.ts (metamodel tools) checks that the first tool edit of a built-in preset copies it under a custom id that survives reloading; packages/ui/tests/model.test.ts checks the same for edits in Studio's store.

Threshold: All tests pass: the first edit of a built-in metamodel yields a custom id, and the built-in preset is unchanged
