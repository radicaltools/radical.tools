---
id: "cf9ab114-0239-4c51-adf7-0ce516a5000e"
type: "requirement"
label: "Wrap selection into container"
action: "Studio shall create a new container of that type around the selected sibling nodes, offering only container types the metamodel allows for them, and push the elements the new container, or the container it grew, then covers clear, pinned ones included, moving nothing else."
ears_type: "event-driven"
rationale: "Introducing a boundary around existing elements is a frequent restructuring step. The new container lay on top of its neighbours, also after a reload (round 170–175, 2026-10-22, F-0020). Evidence: packages/ui/src/components/SelectionActions.tsx (NodeActionItems); packages/ui/src/store/diagramStore.ts (wrapSelectionInNewParent); manual#selection"
trigger: "the user picks a type under Wrap into… in an element's properties card or on the selection bar"
---
