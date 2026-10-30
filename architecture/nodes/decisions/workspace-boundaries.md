---
id: "21964cbd-6238-43e1-a8a9-80bc13ccb696"
type: "fitness-fn"
label: "Workspace boundaries"
category: "structural"
max_age: "14d"
metrics: "workspaces.exit_code == 0"
---

tools/check-workspaces.mjs reads every workspace's imports with TypeScript's pre-processor and fails when a package depends on an app; when an app depends on another app not listed in APP_TO_APP (the VS Code extension and the e2e suite on Studio's build, the e2e suite on Hub's build); when a relative import or triple-slash reference leaves its workspace; when an imported package is not declared in the importing workspace's package.json (phantom dependency; host-provided modules such as vscode excepted); when a tsconfig include, a package.json script or a path in a vite, vitest or electron-vite config reaches into another workspace; and when a workspace with src/ has no typecheck script or one with tests has no test script (the root runs both with --if-present).

It runs on every pull request (ci.yml, where radical sense command measures its exit code for this fitness function), before every deploy from main (deploy.yml) and before an MCP publish (mcp-publish.yml).
