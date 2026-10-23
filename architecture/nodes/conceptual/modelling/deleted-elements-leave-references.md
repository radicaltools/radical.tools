---
id: "e1de5d03-c7df-43d3-adec-aa0fc01fd655"
type: "requirement"
label: "Deleted elements leave references"
action: "The system shall take the element out of every reference property that names it (a transition's trigger event and the events it raises, a requirement's precondition state), removing a single reference and keeping the rest of a list, in the live model and in every later milestone a propagated delete reaches, and in what the other side of a merge made to name it."
ears_type: "event-driven"
rationale: "A reference left behind points at nothing, and Validation reports the edit as breaking the metamodel. Found by the invariants fuzzer once the sample held state machines; Propagate, Unwrap and the 3-way merge left such references until run 184 (2026-10-23, F-0054). Evidence: packages/common/src/model.ts (forgetNodesInReferences); packages/common/src/modelMerge.ts (mergeModels); packages/ui/src/store/diagramStore.ts (commitMilestoneChanges, unwrapNode)"
trigger: "an element is removed from the model: deleted, unwrapped, deleted in a milestone and propagated, or deleted on one side of a merge"
---
