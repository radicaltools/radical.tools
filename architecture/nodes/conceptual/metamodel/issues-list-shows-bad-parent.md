---
id: "71fc0154-4260-4fdc-a0c1-089ada78efa4"
type: "scenario"
label: "Issues list shows bad parent"
gherkin: "# Not covered by an automated test"
given: "a model imported with a Component placed directly inside a Software System"
then: "the Validation panel lists an error that the Component cannot be inside Software System, with an Open in Designer link that selects it"
when: "the user opens the metamodel editor"
---
