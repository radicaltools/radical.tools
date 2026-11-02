---
id: "bca3bb31-0a06-4e9b-9e14-99268a48ef35"
type: "requirement"
label: "Statechart edits refused"
action: "refuse the edit with the reason, in Studio and over MCP, leave the model unchanged, refuse a new element whose wizard links the rules refuse, and make a pseudostate added with no kind where an initial one may not go a choice"
ears_type: "unwanted-behaviour"
rationale: "Studio and agents could build what the statechart rules then flagged, which ADR \"Editors prevent, check detects\" calls a Studio bug (exploratory runs 45 to 64, 2026-10-21, item 221). Evidence: packages/common/src/metamodel/statechart.ts (statechartRefusal), packages/common/src/model.ts, packages/ui/src/store/diagramStore.ts (requestCreateNode), packages/common/src/ai/modelFacade.ts"
unwanted_condition: "the user or an agent makes an edit the statechart rules flag: a transition out of a final state, into an initial pseudostate, a second one out of an initial pseudostate or one leaving its machine (also by moving an end of a transition), a state made final while transitions leave it, an initial pseudostate added, moved or made in a parallel state or beside another, or a second state machine for an entity"
---
