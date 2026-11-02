---
id: "64e73f4b-f002-4ad6-8d7f-a8ed7eeaac31"
type: "requirement"
label: "New element joins active view"
action: "Studio shall add every newly created element to that view."
ears_type: "state-driven"
precondition: "a named view is active"
rationale: "An element you just created must be visible where you created it. Evidence: packages/common/src/model.ts:115-121; packages/ui/tests/model.test.ts:54; manual#elements"
---
