---
id: "d8b001e0-47ab-4397-a986-157a4e0601e9"
type: "scenario"
label: "VS Code two-way sync"
gherkin: "# Not covered by an automated test"
given: "a .radical file is open in the Radical.Tools editor in VS Code"
then: "the editor reloads the git version, and the move is written back into the VS Code document"
when: "the file is changed by git, and then the user moves an element in the editor"
---
