---
id: "fdb1d659-76d8-4a14-b82d-c89b1bde7fc5"
type: "scenario"
label: "Saves wait for the agent"
given: "a folder model open in Studio, and an MCP server writing the same folder"
metrics: |
  test(apps/mcp/src/folderModel.test.ts › folder-backed MCP model › marks the folder as written by an agent after each write) passed
  test(apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › holds its saves while an agent writes the folder, then saves them merged) passed
  test(apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › writes the edits it holds for an agent when the page goes away) passed
  test(apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › keeps those edits for the next visit when the write cannot land before the page goes) passed
  test(apps/e2e/tests/studio/folders.spec.ts › an edit made while an agent writes the folder survives a reload) passed
  test(apps/e2e/tests/studio/folders.spec.ts › an agent mark far ahead of Studio's clock holds the saves for one period, not as long as it says) passed
then: "the MCP server's write leaves a fresh .radical/agent-activity.json; Studio writes nothing while it is fresh and says once that it waits, the agent's second change reaches the canvas with the user's edit kept, and Studio saves the edit once the mark is stale, the agent's changes still in the folder; a reload while the mark is fresh writes the edit at once, or brings it back from the browser on the next opening; a mark an hour ahead holds the rename for one period of 15 seconds, not for the hour"
when: "the agent writes, the user edits an element while the agent's mark is fresh, the agent writes again, and the mark goes stale; or the user reloads the page while the mark is fresh; or the agent's mark lies an hour ahead of Studio's clock and the user renames an element"
---
