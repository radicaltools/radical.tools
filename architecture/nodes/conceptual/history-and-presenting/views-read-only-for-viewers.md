---
id: "95b99c2c-25b2-45a4-96b5-b2197f8dd151"
type: "requirement"
label: "Views read-only for viewers"
action: "Studio shall hide the palette and view editing controls and make the properties panel, table cells, matrix cells and wiki fields read-only."
ears_type: "state-driven"
precondition: "Studio is in the Viewer or Presenter perspective"
rationale: "Stakeholders can explore views without accidentally changing the model. Evidence: apps/studio/src/renderer/src/App.tsx:105-112; apps/studio/src/renderer/src/components/MatrixView.tsx:50, 180; packages/ui/src/components/TableView.tsx:159, 418-421; packages/ui/src/components/WikiView.tsx:176; packages/ui/src/components/RightPanel.tsx:1043-1116; apps/studio/tests/viewerSandbox.test.ts:66-130"
---
