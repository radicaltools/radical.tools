---
id: "0b9c2915-363e-42dd-bb9f-59a64357412c"
type: "requirement"
label: "Route edges around elements"
action: "The canvas shall route that relation around the elements on an obstacle grid with A* path finding instead of drawing the direct curve."
ears_type: "unwanted-behaviour"
rationale: "An edge running through a box suggests a relation that does not exist. Evidence: packages/layout/src/edgeRouting.ts:1-4, packages/layout/src/edgeRouting.ts:359-397; packages/ui/src/components/edges/RelationEdge.tsx:216-295; manual#layout"
unwanted_condition: "the direct Bézier curve of a relation would pass through an element that is neither its endpoint nor an ancestor or descendant of one"
---
