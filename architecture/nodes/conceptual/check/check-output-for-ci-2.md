---
id: "38d2ece7-3939-47be-b452-f58a26e97ee5"
type: "scenario"
label: "Check output for CI"
given: "a model with findings"
tests: |
  apps/cli/src/cli.test.ts › radical check › prints the result as JSON
  packages/common/tests/check.test.ts › radical check: output › shows the first warnings of a rule and how many more there are
  packages/common/tests/check.test.ts › radical check: output › writes GitHub annotations with escaped properties
  apps/cli/src/cli.test.ts › radical check › lists the rules
then: "the JSON holds the counts and each finding; a GitHub annotation names the file with escaped properties; the text shows the first warnings of a rule with how many more there are; --list-rules lists each rule with its default severity"
when: "radical check runs with --format json, with GitHub output, as text, or with --list-rules"
---
