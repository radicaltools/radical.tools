---
id: "fdb1d659-76d8-4a14-b82d-c89b1bde7fc5"
type: "scenario"
label: "Saves wait for the agent"
given: "a folder model open in Studio, and an MCP server writing the same folder"
tests: |
  apps/mcp/src/folderModel.test.ts › folder-backed MCP model › marks the folder as written by an agent after each write
  apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › holds its saves while an agent writes the folder, then saves them merged
then: "the MCP server's write leaves a fresh .radical/agent-activity.json; Studio writes nothing while it is fresh and says once that it waits, the agent's second change reaches the canvas with the user's edit kept, and Studio saves the edit once the mark is stale, the agent's changes still in the folder"
when: "the agent writes, the user edits an element while the agent's mark is fresh, the agent writes again, and the mark goes stale"
---
