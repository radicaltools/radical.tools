---
id: "be730300-e040-4a55-9572-e0e8a308456c"
type: "requirement"
label: "List of the branch's changes"
action: "Studio shall list under the chip the elements added, changed (with the fields that changed) and removed since the base and the relations among them, grouped by kind of change, and, on a click on an element that is still in the model, select it and show it on a canvas view that holds it"
ears_type: "event-driven"
rationale: "The marks show where the changes are on one view; the list shows all of them at once, also those no open view draws, and leads to each. Evidence: apps/studio/src/renderer/src/components/BranchChanges.tsx (BranchChangeList), apps/studio/src/renderer/src/navigation.ts (revealOnCanvas)"
trigger: "the user opens the chip of Changes on branch"
---
