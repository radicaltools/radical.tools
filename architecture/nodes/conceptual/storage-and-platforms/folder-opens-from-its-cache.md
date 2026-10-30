---
id: "b4d521cd-b383-46a0-9e70-79b00acc9c74"
type: "requirement"
label: "Folder opens from its cache"
action: "it shall take from .radical/cache/model.json each file whose stamp is unchanged and read only the files added or changed since; Studio and the MCP server shall write the cache again when it is missing, unreadable, of another format, or out of date by more than 50 files or 1% of the folder."
ears_type: "event-driven"
rationale: "Reading 21,000 files was most of what opening a large folder cost (ADR Model cache beside the model). Evidence: packages/common/src/formats/mdFolderSync.ts (MdFolderSession), packages/common/src/formats/modelCache.ts, packages/node-files/src/diskFolderStorage.ts, apps/studio/src/renderer/src/persist/webFolder.ts"
trigger: "Studio, the MCP server or the CLI opens a model folder"
---
