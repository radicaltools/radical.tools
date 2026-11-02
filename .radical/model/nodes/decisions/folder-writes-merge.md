---
id: "153adb91-307a-43c5-a95b-2770725f5b91"
type: "fitness-fn"
label: "Folder writes merge"
cadence: "triggered"
characteristic: "reliability"
invocation: "automated"
metrics: |
  test(packages/common/tests/modelMerge.test.ts › mergeModels) passed
  test(packages/common/tests/mdFolderSync.test.ts › MdFolderSession) passed
  test(apps/studio/tests/diskFolderStorage.test.ts › diskFolderStorage › detects an outside edit and will not overwrite it) passed
  test(apps/studio/tests/webFolder.test.ts › webFolder read/write › notices a file edited outside the app and refuses to overwrite it) passed
  test(apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits) passed
  test(apps/mcp/src/folderModel.test.ts › folder-backed MCP model › merges an edit made in the folder since the call started) passed
  test(apps/e2e/tests/studio/folders.spec.ts › an edit made outside the app shows up on the canvas) passed
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/modelMerge.test.ts checks the three-way merge of models; packages/common/tests/mdFolderSync.test.ts checks that MdFolderSession merges when given a merge, refuses without one or when the folder does not read, and polls for outside edits; apps/studio/tests/diskFolderStorage.test.ts and webFolder.test.ts check outside edits are seen on disk and in the browser folder; apps/studio/tests/mdFolderWatch.test.ts checks an open document merges unsaved edits and waits for an agent; apps/mcp/src/folderModel.test.ts checks the MCP server merges and marks its activity; apps/e2e/tests/studio/folders.spec.ts checks an outside edit reaches the canvas.

Threshold: All tests pass: no write loses an outside edit or an unsaved one; a field both sides changed keeps the outside value and is reported; each outside edit reported once
