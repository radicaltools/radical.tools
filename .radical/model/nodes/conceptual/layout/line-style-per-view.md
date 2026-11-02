---
id: "b566632d-634c-46dc-a7f8-32ce5a8a9664"
type: "requirement"
label: "Line style per view"
action: "Studio shall draw the relations of a structure view in one style, curved or orthogonal (horizontal and vertical segments with rounded corners, segments sharing a stretch of one line spread apart), set in the view's properties or taken from the model's setting in the activity rail's Settings menu (curved unless changed), which All elements uses; agents set a view's with create_view and update_view; Smart Layout scores the relations as the view draws them."
ears_type: "ubiquitous"
rationale: "Relations were curves, straight lines or right angles depending on what stood in their way, so one diagram mixed all three. Evidence: packages/common/src/c4.ts (EdgeStyle), packages/common/src/model.ts (setViewEdgeStyle, setDefaultEdgeStyle, edgeStyleOf), packages/ui/src/components/RightPanel.tsx (Lines), apps/studio/src/renderer/src/components/Toolbar.tsx (Lines in this model), packages/layout/src/edgeRouting.ts, packages/common/src/ai/tools/viewTools.ts; manual#views"
---
