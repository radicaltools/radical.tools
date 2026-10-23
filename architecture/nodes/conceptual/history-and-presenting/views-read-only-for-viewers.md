---
id: "95b99c2c-25b2-45a4-96b5-b2197f8dd151"
type: "requirement"
label: "Views read-only for viewers"
action: "Studio shall hide the palette and view editing controls, make the properties panel, table cells, matrix cells and wiki fields read-only, and let the special key only select: no pills, no line, no relation and no nesting, the store refusing to add, change, move or remove a relation, nest an element or start a line."
ears_type: "state-driven"
precondition: "Studio is in the Viewer or Presenter perspective"
rationale: "Stakeholders can explore views without accidentally changing the model. In run 178 (round 177–184, 2026-10-23, F-0037) the special key still related and nested elements in Viewer and Presenter, which Designer then did not show. Evidence: apps/studio/src/renderer/src/App.tsx:105-112; apps/studio/src/renderer/src/components/MatrixView.tsx:50, 180; packages/ui/src/components/TableView.tsx:159, 418-421; packages/ui/src/components/WikiView.tsx:176; packages/ui/src/components/RightPanel.tsx:1043-1116; packages/ui/src/store/diagramStore.ts (editsModel); packages/ui/src/components/Canvas.tsx; apps/studio/tests/viewerSandbox.test.ts:66-130"
---
