---
id: "f6f13282-9773-4a5c-bd57-2b72d05eae76"
type: "requirement"
label: "Viewer perspective is read-only"
action: "Studio shall hide the element palette and the selection and edge action bars, disable palette drops and double-click creation, and show properties read-only."
ears_type: "state-driven"
precondition: "the Viewer or Presenter perspective is active"
rationale: "Exploring or presenting a model must not change it by accident. Evidence: packages/ui/src/components/Canvas.tsx:101-105,817-819,946; packages/ui/src/components/RightPanel.tsx:1148-1215; apps/studio/src/renderer/src/App.tsx:107-112; apps/studio/src/renderer/src/components/SelectionActionBar.tsx:168; apps/studio/src/renderer/src/components/EdgeActionBar.tsx:110; manual#workspace"
---
