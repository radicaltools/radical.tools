---
id: "be730300-e040-4a55-9572-e0e8a308456c"
type: "requirement"
label: "List of the branch's changes"
action: "the Changes tab shall name the base, its age and the numbers of elements added, changed and removed, list every element added, changed (with the fields that changed) and removed since the base and the relations among them, grouped by kind of change, and open the panel of an element still in the model on a click, from which Studio shows it on a canvas"
ears_type: "event-driven"
rationale: "The marks show where the changes are on one view; a tab of its own in the Inspector shows all of them at once and leads to each, while Implementation keeps what the tests say of the requirements and ADRs among them. The product owner wanted a separate section in the Inspector rather than a chip over the canvas. Evidence: apps/studio/src/renderer/src/components/inspector/ChangesTab.tsx, components/Inspector.tsx (tabs), components/inspector/shared.tsx (Chip, Peek)"
trigger: "the user opens the Inspector's Changes tab on a model folder that holds a base"
---
