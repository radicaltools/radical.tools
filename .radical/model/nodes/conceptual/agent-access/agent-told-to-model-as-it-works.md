---
id: "243370ec-7638-4690-b801-7487a70388cf"
type: "scenario"
label: "Agent told to model as it works"
given: "the MCP server started on a model folder"
then: "they tell it to keep the model current as it works, before the code, and to run Radical Forge only when the user asks, leaving out stages with forge_skip_stage"
when: "a client connects and reads the server's instructions"
---
