---
id: "d517e522-37fe-40d1-bd4b-3754a1d75366"
type: "fitness-fn"
label: "Folder cache stays derived"
category: "structural"
metrics: |
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › reads only the files changed since, and names them in changes.json, so the next read reads none) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › keeps up with what the session writes) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › writes model.json again once more files than changes.json can stand differ from it) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is rebuilt when it is broken or of another version, and the folder is read whole) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › leaves out a changes.json made for another model.json) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is not needed: a folder whose cache cannot be written still opens) passed
  test(packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › keeps the folder in .radical/cache/model.json, opens from it, and writes it again when it is gone) passed
  test(packages/common/tests/modelCache.test.ts › opening a folder as its cache has it › says which files differ when they changed since, and the next read has them as they are) passed
---

The cache in .radical/cache/model.json repeats the model files and is never their source: a folder opens the same with it, out of date, broken, of another version or gone, and only a model's folder gets one. Checked by the session's tests over a folder in memory and on disk.
