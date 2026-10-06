---
id: "fa5e83f4-9307-4d89-8738-604f98742f41"
type: "scenario"
label: "Flow view from sequence"
gherkin: "# Covered by: packages/ui/tests/views.test.ts › creates a dynamic view with nodes from the sequence relations"
given: "a sequence of relations between four elements and no Flow view for it"
then: "a new active Flow view linked to the sequence lists exactly those four elements"
when: "the user clicks Create Flow view from sequence"
---
