---
id: "7b99eb7c-88b0-4e05-bda0-aa94f51265b9"
type: "scenario"
label: "Example missing from scenarios"
given: "a need whose answer says \"For example, 4 on hand at 4.00 € and 12 received at 6.00 € gives 5.50 €.\", a requirement derived from it and its scenario naming 4 and 12 only"
then: "first it warns on the need naming the example, the scenario and the values \"6\" and \"5.5\"; then nothing"
when: "radical check checks the model, then again with the scenario naming 400, 600 and 550 cents"
---
