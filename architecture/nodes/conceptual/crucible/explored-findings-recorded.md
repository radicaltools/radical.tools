---
id: "8d2c9883-4338-4f6f-a070-ae06295cd846"
type: "scenario"
label: "Explored findings recorded"
given: "a run's report with a bug that has a script importing a helper beside it, and a question"
tests: |
  apps/cli/src/explore.test.ts › radical explore record › writes each finding with a copy of its script, once
  apps/cli/src/explore.test.ts › keeps the screenshot a finding names, beside its script
  apps/cli/src/explore.test.ts › warns about a recorded script that names the round's absolute paths
then: "F-0001 (open) and F-0002 (question) are written with source explore, the round and run, and a copy of the script and its helper; the second time nothing is written"
when: "radical explore record runs on it twice"
---
