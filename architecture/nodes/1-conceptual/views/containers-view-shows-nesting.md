---
id: "e8cca4de-2b71-4d69-bc65-a89fd0f26713"
type: "scenario"
label: "Containers view shows nesting"
gherkin: "# Covered by: apps/e2e/tests/studio/views.spec.ts › Containers (static, nested)"
given: "the bookstore model whose Containers view lists the system and its Web App, API and Orders DB"
then: "the canvas shows 6 nested elements and 4 relations"
when: "the user opens the Containers view by deep link"
---
