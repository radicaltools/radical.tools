---
id: "c6c3f822-2bb8-4edc-82ff-ba470e7cc56e"
type: "requirement"
label: "Reset to C4 preset"
action: "The system shall replace the document's metamodel with the built-in C4 preset."
ears_type: "event-driven"
rationale: "A way back when custom changes went wrong; the confirm warns that custom types are lost. Evidence: apps/studio/src/renderer/src/components/MetamodelEditor.tsx:637-646; packages/ui/src/store/diagramStore.ts:3657-3659"
trigger: "the user confirms \"Reset to C4 preset\" in the metamodel editor"
---
