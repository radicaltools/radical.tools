---
id: "2f1275d6-4a70-4268-a0f3-4d096a17a05a"
type: "requirement"
label: "Review requirements against their needs"
action: "the MCP server shall list each requirement added or changed since the model's base, and each requirement derived from a need added or changed since then (or the requirements named), with its EARS sentence and fields next to the whole text of every need it derives from, directly or through other requirements; name those that derive from no need and the needs that hold no question asked of a person; and ask the agent to write down every value each requirement states (a number, null or zero, a range, a time, a state, who may do what) with the words of its needs that say it, to correct a requirement whose words say something else, and to ask the person or mark as its assumption a value no words say"
ears_type: "event-driven"
rationale: "The agent reads the requirement and the person's words side by side, at the moment it can still correct the requirement before the code. Asked only to confirm or correct, an agent corrected the benchmark's stock value in 1 review of 3; asked to quote the words for each value, in 5 of 5."
trigger: "an agent calls review_requirements"
---
