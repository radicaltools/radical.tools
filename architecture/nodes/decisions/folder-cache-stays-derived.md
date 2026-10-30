---
id: "d517e522-37fe-40d1-bd4b-3754a1d75366"
type: "fitness-fn"
label: "Folder cache stays derived"
category: "structural"
metrics: |
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › reads only the files changed since, and leaves a cache a few files out of date as it is) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is written again once more files than it can stand are out of date) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is rebuilt when it is broken or of another version, and the folder is read whole) passed
  test(packages/common/tests/modelCache.test.ts › a model folder's cache › is not needed: a folder whose cache cannot be written still opens) passed
  test(packages/node-files/tests/diskFolderStorage.test.ts › diskFolderStorage › keeps the folder in .radical/cache/model.json, opens from it, and writes it again when it is gone) passed
---

The cache in .radical/cache/model.json repeats the model files and is never their source: a folder opens the same with it, out of date, broken, of another version or gone, and only a model's folder gets one. Checked by the session's tests over a folder in memory and on disk.
