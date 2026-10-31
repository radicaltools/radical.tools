---
id: "68aa50a2-b7e2-4be0-b886-c139d2ec3e83"
type: "requirement"
label: "Check reads the results of CI"
action: "the CLI shall find, through the GitHub CLI (gh), the nearest commit in HEAD's history that CI ran, a commit merged from a pull request standing for that pull request's head, download the artifacts of its latest completed runs, read the test reports in them as --report reads reports, and keep them in the model folder's .radical/test-results.json with the commit they belong to, the runs they come from with when each ran, and how many commits HEAD is past that commit; it shall keep results read at the same or a later commit with --report, say what is missing without gh, a GitHub remote or a run with reports, and print nothing with --quiet"
ears_type: "event-driven"
rationale: "The full suite takes long to run locally and CI runs it on every pull request; results from CI are tested and tied to a commit (ADR Test results from CI, not from git). Evidence: apps/cli/src/ciResults.ts, apps/cli/src/check.ts (--from-ci), packages/common/src/check/files.ts (TestResults.ci)"
trigger: "radical check runs with --from-ci"
---
