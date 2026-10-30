---
id: "d84e7316-3a60-4c22-a0a8-30680af618f0"
type: "scenario"
label: "Keys stay in a dialog"
given: "a model with an edit made, and the Models dialog open"
metrics: "test(apps/e2e/tests/studio/editing.spec.ts › a dialog keeps the keys: Tab stays in it, Ctrl+Z and F5 leave the model behind it alone) passed"
then: "the focus stays in the dialog, the edit stays and no presentation starts"
when: "the user presses Tab repeatedly, Ctrl/Cmd+Z and F5"
---
