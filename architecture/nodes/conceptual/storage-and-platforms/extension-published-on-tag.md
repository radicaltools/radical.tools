---
id: "769e5dff-4d80-4b0f-ac16-a79aa26f11df"
type: "requirement"
label: "Extension published on tag"
action: "GitHub Actions shall run the type-check and the tests, bundle Studio's web build into the VS Code extension, package it as a VSIX, keep the VSIX as a build artifact and publish it to the VS Code Marketplace."
ears_type: "event-driven"
rationale: "vscode-publish.yml builds the web renderer, copies it into apps/vscode/webview (bundle-webview), compiles the extension and runs vsce package and vsce publish with the VSCE_PAT secret; a manual run with dry_run packages without publishing. Evidence: .github/workflows/vscode-publish.yml, tools/generate-icon.js"
trigger: "a tag vscode-v<version> is pushed"
---
