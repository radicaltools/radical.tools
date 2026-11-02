---
id: "57f56129-528a-42b9-aa17-95c7eeedca02"
type: "scenario"
label: "Rule settings per project"
given: "a model with two requirements no scenario verifies, and a check.json in the model folder or a config file named with --config"
then: "off drops the findings, error fails the check, findings up to the baseline pass as warnings, one metamodel issue kind gets its own severity, unknown keys are named, a config that is no object is refused, and a check.json saved with a byte-order mark is read"
when: "radical check runs with rules set off, to error, with a max baseline, or with a metamodel/<code> key or a key that is no rule"
---
