---
id: "6466b860-fc2e-4b22-84dd-a614b2c12c79"
type: "requirement"
label: "Check an Assay plan"
action: "the system shall refuse the whole plan, name every problem in it and write nothing"
ears_type: "unwanted-behaviour"
rationale: "The server, not the agent, guarantees that every element Assay writes rests on the code. A package or project reference backs a relation either way (a library may be drawn as bundled into what uses it); a call only from the caller to what it calls."
unwanted_condition: "a plan given to assay_apply cites a fact the run does not have, has an observed element or relation that cites no fact, or has an element or relation the metamodel does not allow"
---
