---
id: "0af45fb7-1a0a-48d6-a284-1d8af52a44a1"
type: "component"
label: "Check command"
technology: "Node.js, node:util parseArgs"
---

apps/cli/src/cli.ts (the radical command and its usage) and apps/cli/src/check.ts (radical check). Parses the options, reads the folder with MdFolderSession over @radical/node-files' disk storage, the rule settings (check.json in the folder or --config) the test reports (files, or the .json and .xml files of a directory; or with --from-ci those of CI, through apps/cli/src/ciResults.ts: the nearest commit in HEAD's history a completed GitHub Actions run tested, a squash merge standing for its pull request's head, the artifacts check.json's ci.artifacts names downloaded with gh) and the measurements (.radical/measurements.json, with the radical-metrics/1 files or directories --metrics names merged into it), with a deps.json fetches the dependencies at their pinned refs (Federation command) and checks the model with their elements and relations unless --alone, runs runCheck from @radical/common/check, prints text, JSON (with the dependencies and commits) or GitHub annotations (nothing with --quiet), writes --evidence, .radical/test-results.json (with the commit read at, and for CI the runs) and the ratcheted config, and sets the exit status (0, 1 or 2). --detach starts the same check in the background (Io.background) for the git hooks.
