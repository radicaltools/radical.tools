---
id: "be730300-e040-4a55-9572-e0e8a308456c"
type: "requirement"
label: "List of the branch's changes"
action: "the Inspector shall show the Changes tab first and open on it until another tab is picked; the tab shall name the base, its age and the numbers of elements added, changed and removed, list every element added, changed (with the fields that changed) and removed since the base and the relations among them, grouped by kind of change, and on a click on an element still in the model open beside the list the element's properties card, read-only, with its Changes on branch section and the buttons Show on canvas and Open wiki page"
ears_type: "event-driven"
rationale: "The marks show where the changes are on one view; a tab of its own in the Inspector shows all of them at once and leads to each, while Implementation keeps what the tests say of the requirements and ADRs among them. The card is Designer's own, so an element reads the same wherever it is opened, with the words that changed. Evidence: apps/studio/src/renderer/src/components/inspector/ChangesTab.tsx, components/Inspector.tsx (tabs, the card), packages/ui/src/components/RightPanel.tsx (ElementCard)"
trigger: "the user opens the Inspector on a model folder that holds a base"
---
