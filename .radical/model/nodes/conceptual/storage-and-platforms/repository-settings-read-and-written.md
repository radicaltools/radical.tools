---
id: "efb0caf0-781e-4ca4-88ac-74cfe8eaa4c6"
type: "scenario"
label: "Repository settings read and written"
given: "a .radical/radical.json with tests.include and ci.artifacts, and a check.json still holding them"
then: "check reads the settings from radical.json and warns about those in check.json; Studio writes Include into radical.json"
when: "radical check runs, with --from-ci, and the user changes Include in the Inspector's Settings"
---
