---
id: "258ed3df-d62e-41be-b3b1-b01b536dc8b4"
type: "scenario"
label: "Results fetched from CI"
given: "a git repository with a model folder, two commits past a squash-merged pull request whose CI run kept test reports, and gh answering for GitHub"
metrics: |
  test(apps/cli/src/ciResults.test.ts › radical check --from-ci › reads the reports of the nearest commit CI ran, a squash merge standing for its pull request) passed
  test(apps/cli/src/ciResults.test.ts › radical check --from-ci › keeps results read at a later commit) passed
  test(apps/cli/src/ciResults.test.ts › radical check --from-ci › says what is missing without gh or a run) passed
then: "the check reads the reports of the pull request's run, and .radical/test-results.json names the squash commit, the run, when it ran and that HEAD is 2 commits past it; the results read at HEAD are kept; without gh the command says it needs the GitHub CLI and exits 2, and with --quiet prints nothing"
when: "radical check runs with --from-ci, then again after results were read locally at HEAD, and without gh"
---
