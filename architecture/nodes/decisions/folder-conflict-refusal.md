---
id: "153adb91-307a-43c5-a95b-2770725f5b91"
type: "fitness-fn"
label: "Folder conflict refusal"
category: "operational"
tests: |
  packages/common/tests/mdFolderSync.test.ts › MdFolderSession
  apps/studio/tests/diskFolderStorage.test.ts › diskFolderStorage › detects an outside edit and will not overwrite it
  apps/studio/tests/webFolder.test.ts › webFolder read/write › notices a file edited outside the app and refuses to overwrite it
  apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › keeps the document unchanged on disk when a save is refused as a conflict
  apps/mcp/src/folderModel.test.ts › folder-backed MCP model › rejects a changed folder before writing
  apps/e2e/tests/studio/folders.spec.ts › an edit made outside the app shows up on the canvas
threshold: "All tests pass: zero writes over a file changed outside since the last read; each outside edit reported once"
---

packages/common/tests/mdFolderSync.test.ts checks that MdFolderSession refuses to write over files edited, added or deleted outside since its read and polls for outside edits; apps/studio/tests/diskFolderStorage.test.ts, webFolder.test.ts and mdFolderWatch.test.ts check the same refusal on disk, in the browser folder and in an open document; apps/mcp/src/folderModel.test.ts checks the MCP server; apps/e2e/tests/studio/folders.spec.ts checks an outside edit reaches the canvas.
