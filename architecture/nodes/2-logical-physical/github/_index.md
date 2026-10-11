---
id: "f2d51835-1d89-4283-a8b9-6f3b3e060f05"
type: "system"
label: "GitHub"
external: true
---

Source, issues and pull requests. GitHub Actions runs CI (typecheck, tests, workspace boundaries, e2e), deploys web apps to AWS through OIDC, drafts desktop releases on v* tags and publishes the VS Code extension on vscode-v* tags. MCP package CI verifies tarball installs on Linux and Windows with Node 20 and 24. The manual mcp-publish.yml workflow verifies and uploads the npm tarball by default, and can publish the same archive from main using npm Trusted Publishing after its npm package configuration is set up.
