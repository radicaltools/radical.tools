---
id: "3e50e9e6-6eb4-4176-ae96-39ec7f10e575"
type: "component"
label: "Activation and commands"
technology: "VS Code extension API"
---

apps/vscode/src/extension.ts (activate). Registers the commands Open current file, Open app, Stop (closes every panel) and Show output log, the radical.editor custom editor, a status bar item that shows for an active .c4.json or open panels, the editor-title button on .c4.json files and the Radical.Tools output channel; contributes the JSON schema for *.c4.json and *.radical and the settings radical.projectRoot and radical.npmPath.
