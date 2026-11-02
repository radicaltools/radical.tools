---
id: "f489bcda-d132-4243-9f15-9a8fd658b9f9"
type: "requirement"
label: "A final state holds nothing"
action: "refuse it with the reason, leave the model unchanged, and offer no such place in the table's + rows"
ears_type: "unwanted-behaviour"
rationale: "A state lists state among its allowed parents (for compound states), so every placement check accepted a final state as a parent, which the state machine rules then flagged (exploratory run 26, 2026-10-20): Studio must not let the user build what its own validation flags. Evidence: packages/common/src/metamodel/lookup.ts (isFinalState, isPlacementAllowed), packages/common/src/model.ts (placementError, checkNodeUpdate)"
unwanted_condition: "the user or an agent puts a state or pseudostate inside a final state (a table's + row, a palette drop, a move, add_node, move_node), or makes final a state that holds states"
---
