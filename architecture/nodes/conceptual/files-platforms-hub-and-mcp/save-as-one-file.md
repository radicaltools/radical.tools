---
id: "f5c7f45b-696c-4024-8baf-d3aefa194336"
type: "scenario"
label: "Save as one file"
given: "a model kept in local storage"
tests: "apps/studio/tests/saveAsFile.test.ts › documents.saveAsFile — \"Save as file…\" action"
then: "in the browser the model is downloaded with a sanitised name and stays in local storage; in the desktop app the native Save dialog writes it and the entry becomes file-backed; a cancelled dialog changes nothing"
when: "the user chooses Save as file…"
---
