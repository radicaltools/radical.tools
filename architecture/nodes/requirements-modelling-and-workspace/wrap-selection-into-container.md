---
id: "cf9ab114-0239-4c51-adf7-0ce516a5000e"
type: "requirement"
label: "Wrap selection into container"
action: "Studio shall create a new container of that type around the selected sibling nodes, offering only container types the metamodel allows for them."
ears_type: "event-driven"
rationale: "Introducing a boundary around existing elements is a frequent restructuring step. Evidence: apps/studio/src/renderer/src/components/SelectionActionBar.tsx:46-100,196-233; packages/ui/src/store/diagramStore.ts:1931-2059; manual#selection"
trigger: "the user picks a type under Wrap into… in the selection bar"
---
