---
id: "0c921bba-215e-4295-8f76-95c7b194ff71"
type: "scenario"
label: "Broken folder refused"
gherkin: "# Covered by: apps/mcp/src/folderModel.test.ts › rejects malformed sidecars and symlink escapes"
given: "a model folder whose relations.json is not valid JSON, or whose nodes/ directory is a symbolic link"
then: "it refuses with Malformed JSON in relations.json or symlink in model path"
when: "the MCP server opens the folder"
---
