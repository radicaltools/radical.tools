---
id: "61816c6f-6064-4e0c-8707-b0077a440f1f"
type: "scenario"
label: "File model moved to the browser"
given: "a model kept in a file, opened in Studio, and a model already kept in the browser"
tests: |
  apps/studio/tests/moveToBrowser.test.ts › Move to browser
  apps/e2e/tests/studio/files.spec.ts › Move to browser keeps a file model in this browser and leaves the file as it is
then: "the file model is kept in this browser as shown, listed under Browser, and the file stays as it was; the browser model is left as it is"
when: "the user chooses Move to browser for each and confirms"
---
