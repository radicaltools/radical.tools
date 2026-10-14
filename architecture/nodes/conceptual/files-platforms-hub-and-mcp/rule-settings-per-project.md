---
id: "57f56129-528a-42b9-aa17-95c7eeedca02"
type: "scenario"
label: "Rule settings per project"
given: "a model with two requirements no scenario verifies, and a check.json in the model folder or a config file named with --config"
tests: |
  packages/common/tests/check.test.ts › radical check: config › turns a rule off or into an error
  packages/common/tests/check.test.ts › radical check: config › passes findings up to the baseline as warnings and fails above it
  packages/common/tests/check.test.ts › radical check: config › sets one kind of metamodel issue apart with rule/code
  packages/common/tests/check.test.ts › radical check: config › names config keys that are no rule
  packages/common/tests/checkReports.test.ts › radical check on a model in memory, and the files beside it › reads a config and refuses what is none
  apps/cli/src/cli.test.ts › radical check › exits 1 when the config makes a finding an error, read from the model's check.json
  apps/cli/src/cli.test.ts › radical check › ratchets the baseline in the config file
then: "off drops the findings, error fails the check, findings up to the baseline pass as warnings, one metamodel issue kind gets its own severity, unknown keys are named, and a config that is no object is refused"
when: "radical check runs with rules set off, to error, with a max baseline, or with a metamodel/<code> key or a key that is no rule"
---
