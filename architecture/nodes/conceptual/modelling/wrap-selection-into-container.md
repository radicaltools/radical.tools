---
id: "cf9ab114-0239-4c51-adf7-0ce516a5000e"
type: "requirement"
label: "Wrap selection into container"
action: "Studio shall create a new container of that type around the selected sibling nodes, offering only container types the metamodel allows for them, sized to hug them (their bounds plus the container's padding and header room) with the selected nodes kept where they are drawn; grow each container round it only as far as needed to hold it, left and up included; and push clear only the elements the new container, or a container it grew, then covers, pinned ones included, moving nothing else."
ears_type: "event-driven"
rationale: "Introducing a boundary around existing elements is a frequent restructuring step. The new container lay on top of its neighbours, also after a reload (round 170–175, 2026-10-22, F-0020). It then moved what it wrapped to its parent's padding and grew to its type's default size, pushing a neighbour 174 px; the maintainer decided on 2026-10-23 that the wrapped elements stay where they are and the container hugs them. Evidence: packages/ui/src/components/SelectionActions.tsx (NodeActionItems); packages/ui/src/store/diagramStore.ts (wrapSelectionInNewParent); packages/layout/src/liveColaEngine.ts (invalidate covered); manual#selection"
trigger: "the user picks a type under Wrap into… in an element's properties card or on the selection bar"
---
