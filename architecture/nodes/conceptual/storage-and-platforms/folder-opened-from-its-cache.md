---
id: "ae65aad2-e11a-4c6e-a8c6-8cad714d817a"
type: "scenario"
label: "Folder opened from its cache"
given: "a model folder of 300 files read once, so its cache holds them; and a folder on disk"
metrics: |
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is written when a folder is first read, and the next read takes every file from it) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › reads only the files changed since, and names them in changes.json, so the next read reads none) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › keeps up with what the session writes) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › writes model.json again once more files than changes.json can stand differ from it) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is rebuilt when it is broken or of another version, and the folder is read whole) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › leaves out a changes.json made for another model.json) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is not needed: a folder whose cache cannot be written still opens) passed
  test(packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › keeps the folder in .radical/cache/model.json, opens from it, and writes it again when it is gone) passed
  test(packages/common/tests/modelCache.test.ts › the cache file › is written in ASCII and reads back every character as it was) passed
then: "the second read reads no file; then only the changed files, named in changes.json, and the read after reads none; the written file is read from the cache; after sixty model.json is written again; a broken cache is rebuilt from the whole folder; a changes.json for another model.json is left out; a folder whose cache cannot be written opens all the same; on disk the cache sits in .radical/cache/, is read, and is written again when deleted; the cache file is ASCII and reads back every character"
when: "it is read again; three files change or go and it is read again, and again; the session writes a file and the folder is read again; sixty files change; its cache is broken or of another version; changes.json was made for another model.json; it cannot be written; the cache on disk is changed for a file and then deleted; files with characters outside ASCII are cached"
---
