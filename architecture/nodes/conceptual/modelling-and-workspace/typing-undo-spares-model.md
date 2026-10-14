---
id: "417931ad-cf77-459f-95fe-61f1ba4291e9"
type: "requirement"
label: "Typing undo spares model"
action: "leave the model unchanged and leave the undo to the field's typing"
ears_type: "unwanted-behaviour"
rationale: "Taking back a typo must never take back the model's last step. Evidence: apps/e2e/tests/studio/editing.spec.ts"
unwanted_condition: "the user presses ⌘/Ctrl+Z while typing in a text field"
---
