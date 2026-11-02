---
id: "565a5084-b620-44e1-960a-7e3fd59cc0f2"
type: "requirement"
label: "Types in use stay"
action: "refuse the deletion, say why, and leave the metamodel unchanged"
ears_type: "unwanted-behaviour"
rationale: "The metamodel editor offers no delete for built-in types; the tools enforce the same and also keep a custom type that is still used somewhere. A type deleted while a viewpoint named it stayed in the viewpoint, and one only a milestone held came back as an unknown type on Restore to live (exploratory run 34, 2026-10-20). Evidence: packages/common/src/model.ts (checkRemoveNodeType, checkRemoveRelationType, checkRemoveNodeTypeFromMetamodel, checkRemoveRelationTypeFromMetamodel, viewNamesType, milestoneHoldsType), packages/common/src/ai/tools/metamodelTools.ts (delete_node_type, delete_relation_type), packages/common/src/metamodel/validate.ts, packages/ui/src/store/diagramStore.ts (_typeHolders)"
unwanted_condition: "the user or an agent asks to delete a built-in node or relation type, or a custom one that elements or relations still use, that a milestone holds elements or relations of, or that a viewpoint (making a view per element of it, or in its filter) or a view's filter names"
---
