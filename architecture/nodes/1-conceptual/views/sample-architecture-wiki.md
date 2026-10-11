---
id: "f0285b42-405c-4e10-bd9e-1df5673d5b69"
type: "scenario"
label: "Sample architecture wiki"
gherkin: "# Covered by: apps/e2e/tests/studio/views.spec.ts › Architecture Wiki (view-wiki)"
given: "the bundled Fintech sample is opened"
then: "the URL ends with /v/view-wiki and the wiki matches its screenshot baseline"
when: "the user opens the Architecture Wiki view"
---
