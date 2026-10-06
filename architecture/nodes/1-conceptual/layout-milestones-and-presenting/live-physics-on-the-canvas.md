---
id: "c61f6622-0ece-4ed6-83a3-d6b390b7b461"
type: "requirement"
label: "Live physics on the canvas"
action: "Studio shall run a live WebCoLa force layout that pushes overlapping elements apart and keeps containers wrapped around their children."
ears_type: "state-driven"
precondition: "the Designer or Viewer perspective shows a canvas and no presentation is running"
rationale: "Light physics keeps a hand-arranged diagram tidy without a full re-layout. Evidence: packages/ui/src/layout/liveColaLayout.ts:1-9, packages/ui/src/layout/liveColaLayout.ts:470-600; packages/ui/src/store/diagramStore.ts:3001-3075, packages/ui/src/store/diagramStore.ts:3639-3646, packages/ui/src/store/diagramStore.ts:4373; manual#layout; README (webcola live physics)"
---
