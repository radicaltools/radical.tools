---
id: "f6f13282-9773-4a5c-bd57-2b72d05eae76"
type: "requirement"
label: "Viewer perspective is read-only"
action: "Studio shall hide the element palette, the selection bar and the cards' actions and Delete, disable palette drops and double-click creation, and show properties read-only."
ears_type: "state-driven"
precondition: "the Viewer or Presenter perspective is active"
rationale: "Exploring or presenting a model must not change it by accident. Evidence: packages/ui/src/components/Canvas.tsx; packages/ui/src/components/RightPanel.tsx (readOnly); packages/ui/src/components/SelectionActions.tsx (SelectionActionBar: Designer only); apps/studio/src/renderer/src/App.tsx; manual#workspace"
---
