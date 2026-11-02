---
id: "319f3218-2663-417f-9668-01ee65d6be6f"
type: "scenario"
label: "Hidden relation only in one view"
gherkin: "# Not covered by an automated test"
given: "two views that both show an API and its database with a relation between them"
then: "the relation disappears from the first view and is still drawn in the second view and present in the model"
when: "the user selects the relation in the first view and chooses Hide from view"
---
