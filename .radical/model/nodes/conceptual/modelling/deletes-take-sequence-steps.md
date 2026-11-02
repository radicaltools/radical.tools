---
id: "a547f996-401d-464e-b12a-54a1a08d66ce"
type: "requirement"
label: "Deletes take sequence steps"
action: "Studio and the MCP server shall take those steps out of every sequence, with their notes, in the same undo step as the delete, the Delete prompt saying first how many steps go and delete_relation and delete_node saying how many went"
ears_type: "event-driven"
rationale: "A deleted relation left its steps in the sequences, pointing at nothing, so the flow view played a gap and radical check reported stale references. The maintainer decided on 2026-10-21 (D4, exploratory runs 45 to 64) that the steps go with the relation. Steps left behind by deletes made before the fix stay in the files until edited. Evidence: packages/common/src/model.ts (deleteRelation, deleteNode), packages/ui/src/store/diagramStore.ts, packages/common/src/ai/modelFacade.ts"
trigger: "the user or an agent deletes a relation, or an element with its relations, that steps of a sequence follow"
---
