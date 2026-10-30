---
id: "b7259762-2a1a-403e-9c23-0d6a3ad532ce"
type: "scenario"
label: "Folder opened at once from its cache"
given: "a folder whose cache holds its files; and in Studio a folder model opened once, renamed in, then closed while a name and an element's place change in its files"
metrics: |
  test(packages/common/tests/modelCache.test.ts › opening a folder as its cache has it › lists no file to open it, then lists them and finds them as the cache has them) passed
  test(packages/common/tests/modelCache.test.ts › opening a folder as its cache has it › says which files differ when they changed since, and the next read has them as they are) passed
  test(packages/common/tests/modelCache.test.ts › opening a folder as its cache has it › reads the files whole when there is no cache, and has nothing to say after) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › keeps up with what the session writes) passed
  test(apps/e2e/tests/studio/folders.spec.ts › a folder opened from its cache shows what changed while Studio was closed, places and all) passed
  test(apps/e2e/tests/studio/folders.spec.ts › an outside write during a drag waits for the drop, and the drop lands under the pointer) passed
then: "the open lists no file and reads none, and the listing right after finds nothing changed; when a file changed, the listing names it and the next read has it as it is; Studio's rename is in the cache's changes.json, and reopened Studio shows the new name and the element where the file has it now; a drag while an outside write comes in still lands under the pointer and is what is saved"
when: "a session opens it as its cache has it; then one of its files changes before the next open; Studio opens the folder model again"
---
