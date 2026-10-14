---
id: "f7ab0ab3-373b-4ee2-a0ac-965285f2dc08"
type: "requirement"
label: "Finish a run early"
action: "Radical Forge shall end the run, keep everything generated so far, mark the stages without output as skipped, and let ← Back resume at the stage where the run stopped."
ears_type: "event-driven"
rationale: "Users who only need requirements or scenarios should not have to run every stage. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:512-530,640-658,887-905,922-955; manual#forge"
trigger: "the user presses Finish here during a Forge stage"
---
