---
id: "05608e72-b286-4d06-8760-b6b4e9d966a2"
type: "requirement"
label: ".c4.json beside its text"
action: "The VS Code extension shall open the visual editor beside the text editor, or reveal the one already open for that file, write its edits straight to the file and reload it when the file changes on disk outside the editor."
ears_type: "event-driven"
rationale: "Only .radical files get the custom editor; .c4.json stays a JSON text file with a webview panel next to it. The status bar item shows when a .c4.json is active and marks one already open. Evidence: apps/vscode/src/extension.ts (cmdOpenFile, openInWebview, updateStatusBar), apps/vscode/package.json (menus editor/title)"
trigger: "the user runs Radical.Tools: Open current file, from the editor title button or the status bar item, on an active .c4.json file"
---
