---
id: "158aa6b9-2793-4777-b83c-4b153916bd23"
type: "requirement"
label: "Verification path for agents"
action: "the MCP server and the CLI shall return the same paths the Inspector draws, from one function of @radical/common, need → need up to the broadest need included, as text naming each element with its id, type and status and each test and metric condition with its outcome and failure message; an id the model does not have is refused, naming it; before any results it shall list the tests bound to each scenario and fitness function with no outcome yet, saying that one names no check only when nothing is bound to it; above a failed consumer contract test the other model's requirement or ADR shall be broken, as the check says, and verified only when every check of it runs here and passes, otherwise unverified"
ears_type: "event-driven"
rationale: "An agent fixing a failing check needs the path as much as a person does, and one function keeps the three from telling different stories (the MCP server and Studio share the check already). Before any results the path said that every scenario names no check (F-0148), and above a failed consumer contract test it drew the other model's requirement verified (F-0149, round 211–220; the maintainer's decision: broken, as the check says)."
trigger: "an agent calls the MCP tool get_trace, or a person runs radical check --trace <id>, on an element of the model or of a model it depends on (deps.json)"
---
