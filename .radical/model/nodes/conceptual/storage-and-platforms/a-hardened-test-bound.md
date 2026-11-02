---
id: "fc70f487-3303-4450-bf11-ba366b44ed5e"
type: "scenario"
label: "A hardened test bound"
given: "a repository with its model in .radical/model holding the scenario Undo is exact, and a fuzz finding in .radical/crucible/findings"
then: "the test is bound to the scenario in .radical/radical.json; without the scenario it prints the radical verify command that binds it"
when: "radical harden hardens the finding with --scenario \"Undo is exact\", and in a folder with no such scenario"
---
