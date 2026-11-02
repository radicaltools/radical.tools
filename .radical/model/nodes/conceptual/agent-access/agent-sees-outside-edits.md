---
id: "bed14871-ae1b-4e0e-b944-bcbc034dd296"
type: "scenario"
label: "Agent sees outside edits"
given: "an MCP server that has already answered a call on a model folder"
then: "both calls are accepted against the metamodel as the folder now holds it"
when: "another writer adds a service type and a calls relation type to metamodel.json, and the agent then adds two services and relates them"
---
