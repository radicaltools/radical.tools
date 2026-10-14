---
id: "92cc1d25-e7f4-434d-963e-7ece6b4c44d4"
type: "requirement"
label: "Toggle element in view"
action: "Studio shall add the element to the view, or remove it and all its descendants from the view, without changing the model."
ears_type: "event-driven"
rationale: "Curating which elements a view shows is the core of tailoring views. Evidence: packages/ui/src/components/RightPanel.tsx:155-166; packages/ui/src/store/diagramStore.ts:2306-2336; packages/ui/tests/views.test.ts:56-111; manual#views"
trigger: "the user clicks an element's eye toggle in the Nodes panel while a named view is active"
---
