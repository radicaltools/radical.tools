---
id: "bb775446-0932-4b5e-8593-52282c221fab"
type: "scenario"
label: "Maximum instances refused"
gherkin: "# Not covered by an automated test"
given: "a custom metamodel whose Domain type allows at most 3 instances and a model with 3 domains"
then: "the domain is not added and the message names the maximum of 3"
when: "the user adds a fourth domain"
---
