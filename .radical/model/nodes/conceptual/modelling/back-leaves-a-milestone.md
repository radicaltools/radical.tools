---
id: "1bf29152-a346-438f-8654-f5be50835edb"
type: "requirement"
label: "Back leaves a milestone"
action: "Studio shall leave the milestone and show the live model, first asking how to keep the milestone's edits when it has unsaved ones, and stay on the milestone when the user cancels"
ears_type: "event-driven"
rationale: "Back from a milestone changed the address but left the milestone shown, so the route and the screen disagreed (exploratory runs 45 to 64, 2026-10-21). Evidence: apps/studio/src/renderer/src/route.ts (applyRoute), packages/ui/src/store/diagramStore.ts (selectMilestone)"
trigger: "the user goes back or forward to a place whose route names no milestone while a milestone is shown in Designer"
---
