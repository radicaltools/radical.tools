---
id: "488d1114-fb39-4ec0-8f4f-f3ec67af5862"
type: "requirement"
label: "VS Code pushes file changes"
action: "The VS Code extension shall send the new content to the open Radical editor, which reloads the model, ignoring changes it made itself in the last two seconds."
ears_type: "event-driven"
rationale: "Git operations and other editors stay visible in the diagram. Evidence: apps/vscode/src/extension.ts:79-88,323-335; packages/host-bridge/src/vscode.ts:54-65; apps/studio/src/renderer/src/persistence/autosave.ts:288-302; manual#vscode"
trigger: "the .radical document changes outside the Radical editor"
---
