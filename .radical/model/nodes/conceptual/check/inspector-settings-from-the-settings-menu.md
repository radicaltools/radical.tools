---
id: "5cf16eff-2c71-49c0-a2d9-445dc92367d2"
type: "scenario"
label: "Inspector settings from the Settings menu"
given: "a model folder with check.json"
then: "the change is still there and marked unsaved until Save, and Save writes it to check.json"
when: "the user opens Settings → Inspector settings…, changes a rule's severity, closes the dialog, opens it again and saves"
---
