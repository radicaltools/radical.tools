---
id: "3f6b0f3e-9a75-4ad9-813a-2daaabaee8f4"
type: "adr"
label: "Monorepo with npm workspaces"
alternatives: "Six repositories (studio, hub, web, vscode, common, mcp), proposed in PR #98 and closed as superseded by PR #106."
consequences: "Shared code moves into packages/. tools/check-workspaces.mjs enforces the boundaries in CI. One pull request can change the format and every app at once."
context: "The Hub viewer reuses Studio's canvas and store, the VS Code extension ships Studio's web build, and the MCP server shares the model code. With separate repositories every change to the shared format would need a package publish and version bumps in four repositories."
date: "2026-09-29"
decision: "Keep one npm workspaces monorepo: apps/ for deployables, packages/ for shared code. Apps never import other apps; the only allowed app-to-app link is the VS Code extension shipping Studio's web build."
status: "accepted"
---
