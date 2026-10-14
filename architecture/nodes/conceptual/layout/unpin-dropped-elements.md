---
id: "3b101a8b-f56c-4483-a34d-d0ba0676ac15"
type: "requirement"
label: "Unpin dropped elements"
action: "Studio shall unpin that element, or every pinned element of that row, so the live physics may move them again."
ears_type: "event-driven"
rationale: "Calm drags pins what the user drops; this is the way back. Evidence: packages/ui/src/components/AlignmentGuides.tsx (unpin-node), packages/ui/src/components/RightPanel.tsx (Layout rules, Unpin all), packages/ui/src/store/diagramStore.ts (unpinNodes, removeLayoutConstraint)."
trigger: "the user clicks the pin at the corner of a selected pinned element, or the × of a Pinned row in a view's Layout rules"
---
