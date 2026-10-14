---
id: "5233a918-a426-4fdd-8d41-837a07ea7c7d"
type: "requirement"
label: "Editing a preset forks it"
action: "The system shall first copy the preset to a custom metamodel with the id \"<preset>-custom\" and the name \"<preset name> (custom)\", and apply the change to that copy."
ears_type: "event-driven"
rationale: "A preset id is swapped for the current preset on load, so editing it in place would silently lose the change. Evidence: packages/common/src/model.ts:48-57; packages/ui/src/store/diagramStore.ts:3660-3688; apps/studio/src/renderer/src/components/MetamodelEditor.tsx:614-618; packages/common/tests/aiDocumentTools.test.ts:36-50; manual#metamodel"
trigger: "the user changes a node type, a relation type or the name of a built-in preset metamodel"
---
