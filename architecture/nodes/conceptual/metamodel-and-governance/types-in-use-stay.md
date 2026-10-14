---
id: "565a5084-b620-44e1-960a-7e3fd59cc0f2"
type: "requirement"
label: "Types in use stay"
action: "refuse the deletion, say why, and leave the metamodel unchanged"
ears_type: "unwanted-behaviour"
rationale: "The metamodel editor offers no delete for built-in types; the tools enforce the same and also keep a custom type that elements or relations still use. Evidence: packages/common/src/ai/tools/metamodelTools.ts (delete_node_type, delete_relation_type, checkRemoveNodeTypeFromMetamodel)"
unwanted_condition: "an agent asks to delete a built-in node or relation type, or a custom one that elements or relations still use"
---
