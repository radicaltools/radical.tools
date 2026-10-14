---
id: "d8b001e0-47ab-4397-a986-157a4e0601e9"
type: "scenario"
label: "VS Code two-way sync"
gherkin: "# Not covered by an automated test"
given: "a .radical file is open in the Radical.Tools editor in VS Code"
tests: |
  packages/host-bridge/tests/vscode.test.ts › VS Code webview host › forwards external changes to every listener
  packages/host-bridge/tests/vscode.test.ts › VS Code webview host › posts writes and resolves immediately
then: "the editor reloads the git version, and the move is written back into the VS Code document"
when: "the file is changed by git, and then the user moves an element in the editor"
---
