---
id: "e1de5d03-c7df-43d3-adec-aa0fc01fd655"
type: "requirement"
label: "Deleted elements leave references"
action: "The system shall take the element out of every reference property that names it (a transition's trigger event and the events it raises, a requirement's precondition state), removing a single reference and keeping the rest of a list."
ears_type: "event-driven"
rationale: "A reference left behind points at nothing, and Validation reports the edit as breaking the metamodel. Found by the invariants fuzzer once the sample held state machines. Evidence: packages/common/src/model.ts (forgetNodesInReferences)"
trigger: "an element is removed from the model"
---
