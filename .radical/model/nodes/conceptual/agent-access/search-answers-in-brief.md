---
id: "57e6da7c-a8b7-4f9d-9eff-972ccbd0e3ed"
type: "requirement"
label: "Search answers in brief"
action: "it shall return each element with its id, type, label, parent, technology, origin and status and one sentence of at most 160 characters (a requirement's EARS sentence, an ADR's decision, else its description), each relation once with its type, ends and label, and say that GET NODE <id> or FULL at the end of the query gives everything"
ears_type: "event-driven"
rationale: "Lists and traversals are for finding; reading one element is GET NODE."
trigger: "an agent or the AI assistant runs search_model with LIST NODES, LIST RELATIONS or GET NEIGHBORS, DEPENDENCIES or DEPENDENTS, without FULL"
---
