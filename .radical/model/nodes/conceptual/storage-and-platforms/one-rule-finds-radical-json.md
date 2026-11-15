---
id: "3b4afea1-06bd-4220-8040-e469714bf9a0"
type: "requirement"
label: "One rule finds radical.json"
action: "The CLI, the MCP server and Studio shall read and write the same .radical/radical.json for a model folder: the one found from the folder up to the repository's root, else a new one in the .radical/ of the repository's root, outside git of the folder that holds .radical/model, else beside the model folder"
ears_type: "ubiquitous"
rationale: "Outside a git repository radical implement wrote the file where the MCP server did not read it (round 201–210). One function decides for every writer. Evidence: packages/node-files/src/repositoryLayout.ts (repositoryFileOf, mappingRoot)"
---
