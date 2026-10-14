---
id: "18d7658e-a9dd-40c7-b571-ae6a25601c62"
type: "requirement"
label: "Open .radical in VS Code"
action: "The VS Code extension shall open the file in the Radical.Tools custom editor instead of a text editor."
ears_type: "event-driven"
rationale: "The model is edited where the code lives. Evidence: apps/vscode/src/extension.ts:40-45,58-142; apps/vscode/package.json (customEditors *.radical); manual#vscode"
trigger: "the user opens a .radical file in VS Code"
---
