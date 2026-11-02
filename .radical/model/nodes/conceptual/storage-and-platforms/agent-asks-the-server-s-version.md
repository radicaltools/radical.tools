---
id: "8019ac4c-df3a-491c-8c24-e2f91f41b29d"
type: "scenario"
label: "Agent asks the server's version"
given: "a built radical-mcp server bound to a model folder"
then: "--version prints the package version (with the commit unless built from the release tag), the handshake and get_model_summary's radicalVersion give the same, modelFormat is 1, and .state/agent-activity.json records the client and that version"
when: "it is run with --version, a client connects and calls get_model_summary, and the agent adds an element"
---
