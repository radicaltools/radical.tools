---
id: "ff316abd-3bc9-4bb2-b357-441d307d880d"
type: "requirement"
label: "Batch-draw missing wireframes"
action: "Radical Forge shall draw a wireframe, one mockup at a time, for every mockup in the model that has none, and report how many failed."
ears_type: "event-driven"
rationale: "Screens get a visual draft without opening each mockup, and sequential calls avoid provider rate limits. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:26-37,411-449,851-883; manual#forge"
trigger: "the user presses Generate wireframes after the Mockups stage"
---
