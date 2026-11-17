---
id: "769e5dff-4d80-4b0f-ac16-a79aa26f11df"
type: "requirement"
label: "Extension published on tag"
action: "GitHub Actions shall run the type-check and the tests, bundle Studio's web build into the VS Code extension, package it as a VSIX, keep the VSIX as a build artifact and publish it to the VS Code Marketplace through Trusted Publishing, with the job's GitHub OIDC token and no stored token."
ears_type: "event-driven"
rationale: "vscode-publish.yml builds the web renderer, copies it into apps/vscode/webview (bundle-webview), compiles the extension and runs vsce package and vsce publish --oidc (vsce 4). The job has id-token: write; the Trusted Publishing policy of publisher radical-tools-oss on the Marketplace names the repository radicaltools/radical.tools and the workflow vscode-publish.yml, so no personal access token is kept as a secret. A manual run with dry_run packages without publishing. Evidence: .github/workflows/vscode-publish.yml"
trigger: "a release tag v<version> without a pre-release suffix is pushed"
---
