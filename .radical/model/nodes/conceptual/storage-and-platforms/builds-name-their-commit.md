---
id: "3f1bcb24-433a-48b6-8cff-90f87132da84"
type: "requirement"
label: "Builds name their commit"
action: "Every build of the CLI, the MCP server, the Desktop app, the VS Code extension and Studio on the web shall carry the product version, the commit and the date it was built from, and shall show its version as <version>+<commit> when it is not built from the commit tagged v<version>."
ears_type: "ubiquitous"
rationale: "Two builds from main carry the same version in package.json; only the commit tells them apart. SemVer build metadata (+) does not count when versions are compared."
---
