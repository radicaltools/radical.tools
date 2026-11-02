---
id: "4e7462db-0617-4d5a-a3af-4c13435b8a30"
type: "requirement"
label: "Follow VS Code theme"
action: "Studio shall use VS Code's light or dark theme and switch when the editor theme changes."
ears_type: "state-driven"
precondition: "Studio runs inside a VS Code webview"
rationale: "The embedded editor should look native in the user's IDE. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx:533-557; manual#vscode"
---
