---
id: "90cef56c-6de1-45e4-925b-b9759458224a"
type: "requirement"
label: "Check could not run"
action: "say why on standard error and exit with status 2, without checking"
ears_type: "unwanted-behaviour"
rationale: "Status 2 tells CI apart a broken setup from a model with errors (status 1). Evidence: apps/cli/src/check.ts (checkCommand returns 2), apps/cli/src/cli.ts, apps/cli/src/cli.test.ts › exits 2 when it cannot run, › exits 2 on a report it cannot read, or evidence without a report"
unwanted_condition: "radical check gets invalid options (--evidence without --report among them), cannot read the model folder, a test report or the config that --config names or --ratchet needs"
---
