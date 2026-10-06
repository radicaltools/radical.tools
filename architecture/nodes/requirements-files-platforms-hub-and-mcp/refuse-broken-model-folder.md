---
id: "e79a125d-f05d-480f-a44c-2019aa81d9fa"
type: "requirement"
label: "Refuse broken model folder"
action: "The MCP server shall refuse to open the folder and name the problem."
ears_type: "unwanted-behaviour"
rationale: "An agent must not write into something that is not a valid model. Evidence: apps/mcp/src/folderModel.ts:47-78,138-147; apps/mcp/src/folderModel.test.ts ('rejects malformed sidecars and symlink escapes')"
unwanted_condition: "the folder has no valid radical.md manifest, a malformed JSON sidecar, malformed nodes or a symbolic link in a model path"
---
