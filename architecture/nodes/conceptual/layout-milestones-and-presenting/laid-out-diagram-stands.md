---
id: "68a574e8-280f-4917-a170-9ed3b78c436e"
type: "requirement"
label: "Laid-out diagram stands"
action: "The live layout shall leave every element where it is, and move only elements that are added or shown by an expand, with their nearest surroundings."
ears_type: "state-driven"
precondition: "a canvas shows a diagram whose elements have positions (opened from a file, switched to, restored by undo, or just arranged by Smart Layout)"
rationale: "What Smart Layout chose and reported must be what is saved and shown; a model opened again must not change. Evidence: packages/layout/src/liveColaEngine.ts (rebuild 'rest' and 'local'); packages/layout/tests/liveColaRest.test.ts; manual#layout"
---
