---
id: "fa3b0849-582d-4853-a35c-27d42da359ca"
type: "requirement"
label: "Map elements over MCP"
action: "the server shall say where an element is built (its paths, or its nearest mapped ancestor's, naming it), or list the repository's .radical/radical.json with the C4 elements built nowhere it says; and add, replace or remove an element's entry, refusing an element the model lacks or a path outside the repository"
ears_type: "event-driven"
trigger: "an agent calls get_implementation or set_implementation on the MCP server"
---
