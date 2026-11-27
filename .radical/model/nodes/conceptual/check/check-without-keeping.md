---
id: "996d50e9-092d-4908-873c-d08fe5bb0372"
type: "requirement"
label: "Check without keeping"
action: "the CLI shall read the test reports and measurements it is given and judge the model with them, and write nothing beside the model: neither .state/test-results.json nor .state/measurements.json; --evidence, --ratchet and --adopt still write the file they name"
ears_type: "optional"
feature: "radical check runs with --no-keep"
rationale: "A test of a merge gate runs check on a deliberately broken report; every run left \"1 failed\" in Studio and, read at HEAD, outweighed the results of CI. A flag rather than no write with --format json: the format of the output says nothing about side effects, and agents read json and keep Studio current. Evidence: apps/cli/src/check.ts (--no-keep)"
---
