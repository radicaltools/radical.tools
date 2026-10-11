---
id: "ff2352be-ff15-47cd-80a7-ea1845330830"
type: "requirement"
label: "Collapse folds children away"
action: "the canvas shall hide the container's children and re-attach their relations to the container."
ears_type: "event-driven"
rationale: "Folding a system keeps large models readable without losing the relations that cross its boundary. Evidence: packages/ui/src/components/nodes/C4Nodes.tsx:138-180; packages/ui/src/components/RightPanel.tsx:143-148; packages/ui/src/store/diagramStore.ts:692-770,1642-1700; manual#elements"
trigger: "the user toggles collapse on a container in its node header or in the model tree"
---
