---
id: "cd8853c0-a01f-4c50-a58e-499112b2ac4b"
type: "requirement"
label: "Studio starts in Viewer"
action: "Studio shall show the model in the Viewer perspective; a route keeps the perspective it names, and a model the user creates (an empty one, one Radical Forge fills, the sample, a Structurizr import) opens in Designer, as does a Forge run started from Viewer"
ears_type: "event-driven"
rationale: "Most openings are to look at a model, and Viewer cannot change it by accident; a new model exists to be edited, and Forge's layout runs only in Designer. Viewer is entered through setAppMode, as a switch by hand, so it parks Designer's model and nothing explored in it is saved. Evidence: apps/studio/src/renderer/src/route.ts (startRouteSync, openInDesigner, usePendingMode); apps/studio/src/renderer/src/components/ModelSteps.tsx; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (startRun); manual#workspace"
trigger: "Studio starts without a route in the address"
---
