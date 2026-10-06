---
id: "affc810e-69c8-4dc5-9dd4-97ccaa015ea3"
type: "requirement"
label: "Reject paths leaving folder"
action: "The disk folder storage shall refuse to read or write that path and report an error."
ears_type: "unwanted-behaviour"
rationale: "A symlinked nodes/ or a crafted path must never redirect writes outside the model folder. Evidence: packages/node-files/src/diskFolderStorage.ts:12-30,46,53-55; apps/studio/tests/diskFolderStorage.test.ts ('refuses paths that escape the folder'); apps/mcp/src/folderModel.test.ts ('rejects malformed sidecars and symlink escapes')"
unwanted_condition: "a model path escapes the folder, is not a model file or passes through a symbolic link"
---
