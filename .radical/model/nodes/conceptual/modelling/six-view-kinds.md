---
id: "ebe37e53-6312-4415-9a2e-e3d71bd9def4"
type: "requirement"
label: "Six view kinds"
action: "Studio shall store that kind on the view and render the view with the matching diagram, sequence, treemap, table, matrix or wiki component."
ears_type: "event-driven"
rationale: "Different questions need different readings of the same model. Evidence: packages/ui/src/components/RightPanel.tsx:840-905; apps/studio/src/renderer/src/App.tsx:110; packages/common/src/c4.ts:71-81; packages/ui/tests/views.test.ts:217-230; manual#views"
trigger: "the user picks Structure, Flow, Hierarchy, Table, Matrix or Wiki as a view's type"
---
