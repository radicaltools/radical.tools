---
id: "e81279dc-b55b-4e18-b449-9ed917821dbf"
type: "requirement"
label: "Move selection to container"
action: "Studio shall re-parent the selected siblings into that target, keeping their position on the canvas, and on every other canvas where they then lie inside the target, placing them inside it beside its children elsewhere, offering only allowed targets outside the selected subtrees."
ears_type: "event-driven"
rationale: "Re-parenting without redrawing keeps relations and layout intact; a canvas the move was not made on read the old parent-relative place against the new parent and drew the element outside it (exploratory run 27, 2026-10-20). Evidence: apps/studio/src/renderer/src/components/SelectionActionBar.tsx; packages/ui/src/store/diagramStore.ts; packages/common/src/model.ts (reparentNodes); packages/ui/tests/model.test.ts; packages/ui/tests/reparentOnEveryCanvas.test.ts; manual#selection"
trigger: "the user picks a target under Move to… in the selection bar"
---
