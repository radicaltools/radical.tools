---
id: "ae65aad2-e11a-4c6e-a8c6-8cad714d817a"
type: "scenario"
label: "Folder opened from its cache"
given: "a model folder of 300 files read once, so its cache holds them; and a folder on disk"
metrics: |
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is written when a folder is first read, and the next read takes every file from it) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › reads only the files changed since, and leaves a cache a few files out of date as it is) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is written again once more files than it can stand are out of date) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is rebuilt when it is broken or of another version, and the folder is read whole) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is not needed: a folder whose cache cannot be written still opens) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › opens as the cache has it, without looking at the files, and the next poll reports what changed since) passed
  test(packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › keeps the folder in .radical/cache/model.json, opens from it, and writes it again when it is gone) passed
  test(packages/common/tests/modelCache.test.ts › the cache file › is written in ASCII and reads back every character as it was) passed
then: "the second read reads no file; then only the changed files, and the cache is left as it is; after sixty it is written again; a broken cache is rebuilt from the whole folder; a folder whose cache cannot be written opens all the same; Studio's first read lists no file and takes the cache's content, and the next poll reports the changed file, whose next read is current; on disk the cache sits in .radical/cache/model.json, is read, and is written again when deleted; the cache file is ASCII and reads back every character"
when: "it is read again; three files change or go and it is read again; sixty change; its cache is broken or of another version; it cannot be written; Studio opens it after a file changed; the cache on disk is changed for a file and then deleted"
---
