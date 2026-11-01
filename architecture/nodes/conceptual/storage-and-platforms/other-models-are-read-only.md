---
id: "16931618-6985-448b-a70c-ca7ab5256f20"
type: "requirement"
label: "Other models are read-only"
action: "Studio and the MCP server shall refuse it and say which model the element belongs to"
ears_type: "unwanted-behaviour"
rationale: "A change to another model belongs in its repository; refused at once, it is not lost later when the composed folder is synced. Positions on this model's views and relations from this model's elements to them stay free. Evidence: packages/common/src/model.ts (originOf, checkAddNode, checkNodeUpdate, checkReparent, checkUnwrap, checkPatchRelation, checkRemove), packages/common/src/ai/modelFacade.ts, packages/common/src/ai/tools/nodeTools.ts and relationTools.ts (delete_node, update_relation, delete_relation), packages/ui/src/store/diagramStore.ts (also the Delete key, refused before its prompt)"
unwanted_condition: "a user or an agent changes, renames, moves, deletes or puts an element inside an element or relation that has an origin"
---
