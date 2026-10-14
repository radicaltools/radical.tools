---
id: "b51394a6-a991-41c0-8520-16ff6b55ed9f"
type: "requirement"
label: "Unreadable folder stops check"
action: "report each as an error with its file and check nothing else of the model"
ears_type: "unwanted-behaviour"
rationale: "Nothing else can be read reliably from such a folder. Evidence: packages/common/src/check/index.ts (FOLDER_RULES folder-manifest, folder-json, folder-conflict; FATAL; runCheck), apps/cli/src/cli.test.ts › exits 1 on a folder that is no model"
unwanted_condition: "the model folder has no valid radical.md manifest, a JSON sidecar that does not parse, or a node file holding git conflict markers"
---
