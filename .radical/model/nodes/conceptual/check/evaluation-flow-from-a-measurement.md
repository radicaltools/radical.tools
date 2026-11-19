---
id: "c8357ca6-8e59-4145-8107-c5e51abf8802"
type: "requirement"
label: "Evaluation flow from a measurement"
action: "show that element's verification path in the Inspector, as Path on the properties card does, from its need or ADR down to the tests and the metric conditions with their measurements, and go back to the Measurements tab on Back"
ears_type: "event-driven"
rationale: "The product owner asked to see the full evaluation flow from a value: the path is that flow, and it exists already (Verification path panel); the tab only opens it. Evidence: apps/studio/src/renderer/src/components/inspector/MeasurementsTab.tsx, components/Inspector.tsx (onTrace), components/inspector/TracePanel.tsx"
trigger: "Path is pressed on a scenario or fitness function listed under a measurement"
---
