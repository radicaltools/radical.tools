---
id: "ad64d0fd-5d9c-47b5-9d8e-08dca03c9bd4"
type: "scenario"
label: "Check passes with warnings"
given: "a model folder with one requirement no scenario verifies, and no check.json"
metrics: "test(apps/cli/src/cli.test.ts › radical check › exits 0 with warnings only, and says what it found) passed"
then: "the output lists requirement-without-scenario with the requirement's file, ends with 0 errors and 1 warning, and the exit status is 0"
when: "the user runs `radical check model`"
---
