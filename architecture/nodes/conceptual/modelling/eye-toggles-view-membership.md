---
id: "80ef8b05-8e97-481b-992f-0db7e32ca025"
type: "requirement"
label: "Eye toggles view membership"
action: "Studio shall add the element to that view, or remove it together with its descendants, without changing the model."
ears_type: "event-driven"
rationale: "Elements exist once and appear in as many views as needed, so visibility is a view setting, not a delete. Evidence: packages/ui/src/components/RightPanel.tsx:95-176; packages/ui/src/store/diagramStore.ts:2306-2336; manual#elements; manual#workspace"
trigger: "the user clicks the eye icon of an element in the model tree while a named view is active"
---
