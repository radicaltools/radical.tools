---
id: "f37f49bf-f711-4f4e-8979-286492a7d484"
type: "requirement"
label: "Unwrap keeps children"
action: "Studio shall remove the container, move its direct children to its parent at their current position and keep the children's relations."
ears_type: "event-driven"
rationale: "Removing a boundary must not throw away what was inside it. Evidence: apps/studio/src/renderer/src/components/SelectionActionBar.tsx:171-177,277-296; packages/ui/src/store/diagramStore.ts:2062-2152; manual#selection"
trigger: "the user clicks Unwrap with a single container selected"
---
