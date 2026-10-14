---
id: "9115a86e-67af-4755-9109-82ba14e43a78"
type: "requirement"
label: "Build web app on demand"
action: "The VS Code extension shall offer to build Studio's web app (npm run build:web in the project root, with its output in the Radical.Tools output channel) and open the editor once the build succeeds, or show the build error."
ears_type: "unwanted-behaviour"
rationale: "A developer install from a checkout has no bundled webview/; radical.projectRoot and radical.npmPath settings point at the checkout and npm. Evidence: apps/vscode/src/extension.ts (getOutDir, buildWebApp), apps/vscode/package.json (configuration)"
unwanted_condition: "the VS Code extension finds neither its bundled web build nor a Studio build in the project root"
---
