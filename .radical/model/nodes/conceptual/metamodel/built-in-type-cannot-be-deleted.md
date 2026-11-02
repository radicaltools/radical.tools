---
id: "c077ae67-ee24-48db-a59e-f49855b94e8e"
type: "scenario"
label: "Built-in type cannot be deleted"
gherkin: "# Not covered by an automated test"
given: "the metamodel editor lists the ADR type marked built-in and a custom type"
then: "only the custom type has a Delete type button, and the ADR type stays in the metamodel"
when: "the user looks for the delete control on each card"
---
