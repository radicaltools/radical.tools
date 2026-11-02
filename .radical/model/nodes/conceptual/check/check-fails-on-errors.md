---
id: "6f1397f3-32fe-4cd5-8677-dc717ec402a2"
type: "requirement"
label: "Check fails on errors"
action: "exit with status 1, and with status 0 when there are warnings only"
ears_type: "unwanted-behaviour"
rationale: "The exit status is what makes the check a gate in CI. Evidence: apps/cli/src/check.ts"
unwanted_condition: "a finding is an error once the project's config is applied"
---
