---
id: "4d5d5b8f-0aa1-426e-ba4b-8f8623a9130e"
type: "requirement"
label: "Milestone diff overlay"
action: "The canvas shall colour the elements and relations added, changed or removed since the previous milestone, draw removed ones as dashed ghosts, and show the added/changed/removed counts on the chip."
ears_type: "state-driven"
precondition: "a milestone other than the oldest is shown and the diff toggle on its chip is on"
rationale: "Seeing what changed between two points in time is the main reason to keep milestones. Evidence: packages/ui/src/store/diagramStore.ts:3241-3285, packages/ui/src/store/diagramStore.ts:3496-3570, packages/ui/src/store/diagramStore.ts:1380-1390, packages/ui/src/store/diagramStore.ts:176-214; packages/ui/src/components/nodes/C4Nodes.tsx:10-20; packages/ui/src/components/edges/RelationEdge.tsx:207, packages/ui/src/components/edges/RelationEdge.tsx:297-304; packages/ui/src/components/Canvas.tsx:873-888; packages/ui/tests/milestones.test.ts:74-91; manual#milestones"
---
