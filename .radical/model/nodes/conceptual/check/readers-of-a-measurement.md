---
id: "ee63ead7-610c-4133-9e0d-54db26fa826a"
type: "requirement"
label: "Readers of a measurement"
action: "show under each measurement every scenario and fitness function whose metric condition reads it (for a fitness function measured for each element, the element it was read for), with the condition as written and its outcome (passed, failed, stale or invalid, with the detail of why), and mark a measurement no condition reads as read by nothing"
ears_type: "ubiquitous"
rationale: "The product owner wants to see from a value which fitness functions and scenarios it belongs to. The readers come from the check's evidence: a condition's result names the measurement it was decided by. Evidence: apps/studio/src/renderer/src/components/inspector/MeasurementsTab.tsx (readersOf), packages/common/src/check/evidence.ts (ConditionResult.measurement)"
---
