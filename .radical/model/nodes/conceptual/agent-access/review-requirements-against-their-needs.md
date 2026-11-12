---
id: "2f1275d6-4a70-4268-a0f3-4d096a17a05a"
type: "requirement"
label: "Review requirements against their needs"
action: "the MCP server shall list each requirement added or changed since the model's base, and each requirement derived from a need added or changed since then (or the requirements named), with its EARS sentence and fields next to the whole text of every need it derives from, directly or through other requirements; name those that derive from no need and the needs that hold no answer of a person; and ask the agent to confirm each or correct it where it adds, drops or changes a value, a number, a range, a state or who may do what"
ears_type: "event-driven"
rationale: "The agent reads the requirement and the person's words side by side, at the moment it can still correct the requirement before the code."
trigger: "an agent calls review_requirements"
---
