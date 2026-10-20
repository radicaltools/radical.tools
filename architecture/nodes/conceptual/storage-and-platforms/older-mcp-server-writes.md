---
id: "d1abec72-68c1-4701-bbea-48cb86fbd514"
type: "scenario"
label: "Older MCP server writes"
given: "Studio 0.3.0+1a2b3c4 open on a folder model"
tests: |
  apps/studio/tests/agentVersion.test.ts › warns once when an agent writes through an MCP server of another version
  apps/studio/tests/agentVersion.test.ts › names a newer server as newer
then: "Studio says nothing for the build of its own version, warns once that the agent's server 0.2.0+716e537 is older than Studio and should be updated, and says nothing for the server without a version; a newer server is named newer, with Studio to update"
when: "an agent writes the folder through radical-mcp 0.3.0+9f8e7d6, then twice through 0.2.0+716e537, then through a server that records no version"
---
