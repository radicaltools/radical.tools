---
id: "aa19d121-fc39-4ce3-b196-51a4aa06d4df"
type: "scenario"
label: "Present while a name is typed"
given: "a slide's name, a table cell (F2) or a Warnier step being typed"
tests: |
  apps/e2e/tests/studio/presentation.spec.ts › F5 and Cmd/Ctrl+P in a slide's name field are Studio's: F5 saves the name and presents
  apps/e2e/tests/studio/presentation.spec.ts › F5 while a name is typed in the table or in a Warnier step saves it, then presents
then: "the name is saved, then the presentation starts; Cmd/Ctrl+P is Studio's, not the browser's"
when: "the user presses F5, or Cmd/Ctrl+P in the slide's name field"
---
