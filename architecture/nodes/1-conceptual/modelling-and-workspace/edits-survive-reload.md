---
id: "428b9a5c-3fb4-4a2a-935e-c8a09b644f16"
type: "scenario"
label: "Edits survive reload"
gherkin: "# Covered by: apps/e2e/tests/studio/editing.spec.ts › edits survive a reload"
given: "the user added an element and a relation"
then: "the view still shows 4 elements and 3 relations"
when: "the page is reloaded"
---
