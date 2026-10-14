---
id: "33ba6759-7996-4e5f-b29a-f680b4f8c949"
type: "requirement"
label: "Undo waits for wizard"
action: "leave the model unchanged and keep the wizard open with what was entered in it"
ears_type: "unwanted-behaviour"
rationale: "Undo took back the element the wizard was creating its child in; Create then saved a child of nothing and the model could not be opened again. Evidence: apps/e2e/tests/studio/runs-13-24.spec.ts"
unwanted_condition: "the user presses Ctrl/Cmd+Z while a node wizard is open"
---
