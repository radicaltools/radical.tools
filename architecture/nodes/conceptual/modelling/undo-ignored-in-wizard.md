---
id: "25207a3e-e535-4900-a441-e22f51dfd669"
type: "scenario"
label: "Undo ignored in wizard"
given: "an ADR wizard opened by dropping an ADR into a new Software System, with a name and a status filled in"
metrics: "test(apps/e2e/tests/studio/runs-13-24.spec.ts › Ctrl/Cmd+Z in an open wizard leaves the model behind it alone) passed"
then: "the wizard stays open and the canvas keeps every element; Ctrl+Enter then creates the ADR inside the system, which is still there"
when: "the user presses Ctrl/Cmd+Z, then Ctrl+Enter"
---
