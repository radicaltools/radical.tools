---
id: "240f3043-d601-4a8c-ad29-954dd8e94720"
type: "requirement"
label: "Base saved beside the model"
action: "the CLI and the MCP server shall write the elements and relations of the model at the git base, with their All elements positions, the base commit, how it was chosen, the branch checked out and the time, to .radical/base.json in the model folder (with the .gitignore of .radical/), and leave the model's own files untouched"
ears_type: "event-driven"
rationale: "Studio has no git: in the browser it reads only the model folder. A copy of the base beside the model is all it needs to compare the model with it as it is edited; the positions only place the ghosts of removed elements, the comparison leaves them out. get_changes saves only its default base, the one Studio shows. Evidence: packages/node-files/src/gitModel.ts (modelChangesSince saveBase, currentBranch), packages/common/src/formats/modelBase.ts, apps/cli/src/diff.ts (--save-base, --quiet), apps/mcp/src/folderModel.ts (get_changes)"
trigger: "radical diff runs with --save-base, or an agent calls get_changes, on a model folder in a git repository"
---
