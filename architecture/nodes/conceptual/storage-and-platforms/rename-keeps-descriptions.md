---
id: "f190776c-8f99-49a6-beb7-51a2cbfb9813"
type: "scenario"
label: "Rename keeps descriptions"
gherkin: "And nodes/reader.md exists"
given: "the sample model is saved as a folder and the page was reloaded"
metrics: "test(apps/e2e/tests/studio/folders.spec.ts › moving files keeps the elements' descriptions) passed"
then: "the children's files move to nodes/online-shop/ with their descriptions intact and nothing is left under nodes/bookstore/"
when: "the user renames Bookstore to Online Shop and Customer to Reader"
---
