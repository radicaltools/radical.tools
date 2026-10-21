---
id: "6cc372f7-bf72-4ca2-b90b-457f1b2f0e0e"
type: "requirement"
label: "Model changes since git"
action: "the MCP server and the CLI shall list the elements and relations added, removed and changed between the model at the git base (the ref given, else the merge base of the current branch with the default branch, else HEAD) and the folder as it is on disk, uncommitted edits included, with each changed field's old and new value and each element's ancestors and relations, count an empty text, an unticked box or an empty list as no value, leave out views, positions, sizes and folding, refuse a folder outside git and an unknown or option-like ref, and write nothing"
ears_type: "event-driven"
rationale: "A new or changed requirement is a change of the model, and the agent implements that change: the difference between the model the code follows (the one in git, since the model describes the current implementation) and the one the product owner edited. A raw git diff of the folder is mostly layout (PR #203: about 540 elements moved, 16 fields changed) and ids; the list keeps the fields and adds what an agent needs to find the place in the code, the satisfying component and the scenarios with their tests. Evidence: packages/common/src/modelChanges.ts (modelChangeReport, formatModelChanges), packages/node-files/src/gitModel.ts (resolveGitBase, readModelAtCommit, modelChangesSince), apps/mcp/src/folderModel.ts (get_changes), apps/mcp/src/index.ts (instructions), apps/cli/src/diff.ts"
trigger: "an agent calls get_changes, or someone runs radical diff, on a model folder in a git repository"
---
