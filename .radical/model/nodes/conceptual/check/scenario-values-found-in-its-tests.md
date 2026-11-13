---
id: "736d4ae1-cce0-4a68-8f81-49a8716250e3"
type: "scenario"
label: "Scenario values found in its tests"
given: "a repository whose .radical/radical.json binds a test file to a scenario that names 984, 23 %, 3 lines and the date 2026-03-14, the file holding 23 but not 984"
then: "it warns that the scenario names \"984\", which the file of the test bound to it does not use, and asks nothing about 3 or the date"
when: "radical check runs in it"
---
