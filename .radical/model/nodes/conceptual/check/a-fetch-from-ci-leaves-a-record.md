---
id: "2e699d1c-077b-43c0-ad14-38fc74b322ae"
type: "requirement"
label: "A fetch from CI leaves a record"
action: "the CLI shall write to the model folder's .state/ci-fetch.json when it fetched, the commit HEAD was at, what it found (the results of CI read, the same runs as before, results kept that were read with --report at a later commit, or none) and, when it found none or could not fetch, what it said, so that a fetch the git hooks start with their output closed still tells what it found"
ears_type: "event-driven"
rationale: "isostride's hooks fetched for weeks without finding a test report (their CI kept the reports in S3), and the hooks send the message to /dev/null: Studio showed the last results kept with no word that fetching failed. Evidence: apps/cli/src/check.ts (--from-ci), apps/cli/src/ciResults.ts, packages/common/src/check/files.ts (CI_FETCH_FILE)"
trigger: "radical check runs with --from-ci, with --quiet too"
---
