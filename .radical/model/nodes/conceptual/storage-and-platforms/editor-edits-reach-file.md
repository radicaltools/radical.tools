---
id: "1099eea0-6d6c-4baf-b60c-a1af3ad091c9"
type: "requirement"
label: "Editor edits reach file"
action: "The VS Code extension shall replace the VS Code document's text with the model's new JSON."
ears_type: "event-driven"
rationale: "Keeps the file and the editor in sync in the other direction. Evidence: apps/vscode/src/extension.ts:90-101,337-346; packages/host-bridge/src/vscode.ts:76-80; apps/studio/src/renderer/src/persistence/autosave.ts:278-286; manual#vscode"
trigger: "the model changes in the Radical editor inside VS Code"
---
