---
id: "158aa6b9-2793-4777-b83c-4b153916bd23"
type: "requirement"
label: "Verification path for agents"
action: "the MCP server and the CLI shall return the same paths the Inspector draws, from one function of @radical/common, as text naming each element with its id, type and status and each test and metric condition with its outcome and failure message; an id the model does not have is refused, naming it"
ears_type: "event-driven"
rationale: "An agent fixing a failing check needs the path as much as a person does, and one function keeps the three from telling different stories (the MCP server and Studio share the check already)."
trigger: "an agent calls the MCP tool get_trace, or a person runs radical check --trace <id>, on an element of the model"
---
