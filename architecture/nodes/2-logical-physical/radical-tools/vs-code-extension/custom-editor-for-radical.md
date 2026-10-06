---
id: "449165ce-6dc3-4ce4-9b0a-52921c39245d"
type: "component"
label: "Custom editor for .radical"
technology: "CustomTextEditorProvider"
---

RadicalEditorProvider. Webview writes become WorkspaceEdits on the open document, so VS Code owns saving and undo; document changes are pushed back to the webview with echo suppression.
