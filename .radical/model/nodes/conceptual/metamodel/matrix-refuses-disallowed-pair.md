---
id: "7085d61d-411b-4f15-b407-5d5ff4f578b4"
type: "scenario"
label: "Matrix refuses disallowed pair"
gherkin: "# Not covered by an automated test"
given: "a Matrix view in the Designer perspective where the metamodel allows no relation from a database to a person"
then: "no relation is created and a 'Relation not allowed' error is shown"
when: "the user clicks the empty cell in the database row and the person column"
---
