---
id: "0af45fb7-1a0a-48d6-a284-1d8af52a44a1"
type: "component"
label: "Check command"
technology: "Node.js, node:util parseArgs"
---

apps/cli/src/cli.ts (the radical command and its usage) and apps/cli/src/check.ts (radical check). Parses the options, reads the folder with MdFolderSession over @radical/node-files' disk storage, the rule settings (check.json in the folder or --config) and the test reports (files, or the .json and .xml files of a directory), runs runCheck from @radical/common/check, prints text, JSON or GitHub annotations, writes --evidence, .radical/test-results.json and the ratcheted config, and sets the exit status (0, 1 or 2).
