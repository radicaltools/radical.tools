---
id: "de678c30-acf0-4848-8555-c687c7686980"
type: "scenario"
label: "Setup writes each agent's configuration"
given: "a git repository with an empty model folder, a .mcp.json that holds another server, a Codex config.toml with a section of its own and a Claude Desktop configuration"
tests: "apps/cli/src/setup.test.ts › radical setup › writes each agent's configuration once, keeps their other entries, and starts the model"
then: "the folder holds a new model with the chosen metamodel; .mcp.json and .vscode/mcp.json name npx with the pinned package and the folder's path from the top; Claude Desktop's, Cursor's and Codex's configurations name npx by its absolute path with node's directory on PATH and keep their other entries, backed up first; the hooks save the base; the second run changes nothing, the changed entry is replaced, the dry run writes nothing, and the folder with other files exits 2"
when: "radical setup runs for the folder for every agent with --yes, again, after its entry was changed by hand, with --dry-run, and for a folder that holds other files"
---
