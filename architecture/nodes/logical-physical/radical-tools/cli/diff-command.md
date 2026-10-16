---
id: "731e69c8-4e87-44fd-ab1a-196edfb83008"
type: "component"
label: "Diff command"
technology: "Node.js, node:util parseArgs"
---

apps/cli/src/diff.ts (radical diff). Parses [folder], --since, --format, --save-base and --quiet, reads the folder with MdFolderSession over @radical/node-files' disk storage, runs modelChangesSince from @radical/node-files/gitModel (with --save-base also writing the base to .radical/base.json for Studio) and prints the list as text or JSON (with the base commit); --quiet with --save-base prints nothing, for the git hooks; exit 0, or 2 when the folder is not in git or the ref is unknown.
