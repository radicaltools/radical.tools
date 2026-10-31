---
id: "622e7c01-cc67-45d4-a932-592f2e0aed00"
type: "requirement"
label: "Test results for Studio"
action: "keep the test cases it read, with when, from which reports and at which commit of git, in the model folder's .radical/test-results.json, adding the .gitignore that keeps .radical out of version control"
ears_type: "event-driven"
rationale: "Studio's Inspector works out what the tests say about the model as it is edited from this file, so it never goes into git or into the model's files. Evidence: apps/cli/src/check.ts (writeBeside, serializeTestResults), packages/common/src/check/files.ts (TEST_RESULTS_FILE), packages/node-files/src/selectionFile.ts (readCheckFiles)"
trigger: "radical check runs with --report"
---
