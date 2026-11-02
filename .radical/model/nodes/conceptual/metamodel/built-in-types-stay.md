---
id: "ef5a3079-48c7-43b9-a20d-fa7fea8e32dd"
type: "requirement"
label: "Built-in types stay"
action: "The system shall keep the type and offer no delete control for it in the metamodel editor."
ears_type: "unwanted-behaviour"
rationale: "Built-in types back the canvas, views and tools, so they may be extended but not removed. Evidence: packages/ui/src/store/diagramStore.ts:3669-3688; apps/studio/src/renderer/src/components/MetamodelEditor.tsx:162-175,351-367; manual#metamodel"
unwanted_condition: "the user tries to delete a built-in node type or relation type"
---
