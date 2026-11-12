---
id: "86065ac2-c681-40b2-9c04-1015da6a26ff"
type: "requirement"
label: "Type details on request"
action: "the MCP server shall return only the whole definition of each node type, relation type and viewpoint named (properties with labels, enum options, reference targets and visibility, allowed parents, cardinality, pairs, layout, a viewpoint's chain), and name the ids it does not know"
ears_type: "event-driven"
rationale: "Details an agent needs for one type should not cost it the whole metamodel."
trigger: "an agent calls get_model_summary with types"
---
