---
id: "2fa24bc1-e1b1-41a3-bad1-4df8727645e2"
type: "requirement"
label: "Scenario values in their tests"
action: "it shall report a warning on the scenario naming the values and the tests"
ears_type: "event-driven"
rationale: "A test bound to a scenario passes whether or not it checks what the scenario says. In the benchmark 16 of 94 scenarios named a value their tests' files did not hold, such as a price floor of 984 that the test checked only as at least 800. The file, not the test's body, is read: fixtures sit beside the test."
trigger: "radical check runs in a repository whose .radical/radical.json binds tests to a scenario that names a value telling a case apart (a number of 10 or more, a fraction, a percentage, null, true, false, an identifier; not a count below 10, a date or a time of day) which the files of none of those tests hold"
---
