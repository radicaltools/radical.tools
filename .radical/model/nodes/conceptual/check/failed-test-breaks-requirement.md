---
id: "a3eb612b-d49f-447f-8963-8ae32ae2c0d5"
type: "scenario"
label: "Failed test breaks requirement"
given: "a requirement verified by a scenario that names two tests, and a Vitest JSON report in which one of them failed"
then: "the check fails, says the scenario's test failed and the requirement is not verified now, sums up 1 broken requirement, and evidence.json marks the requirement broken"
when: "the user runs `radical check model --report red.json --evidence evidence.json`"
---
