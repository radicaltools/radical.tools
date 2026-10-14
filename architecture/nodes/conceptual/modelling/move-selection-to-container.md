---
id: "e81279dc-b55b-4e18-b449-9ed917821dbf"
type: "requirement"
label: "Move selection to container"
action: "Studio shall re-parent the selected siblings into that target, keeping their position on the canvas, offering only allowed targets outside the selected subtrees."
ears_type: "event-driven"
rationale: "Re-parenting without redrawing keeps relations and layout intact. Evidence: apps/studio/src/renderer/src/components/SelectionActionBar.tsx:102-166,235-276; packages/ui/src/store/diagramStore.ts:2154-2198; packages/common/src/model.ts:146-191; packages/ui/tests/model.test.ts:238; manual#selection"
trigger: "the user picks a target under Move to… in the selection bar"
---
