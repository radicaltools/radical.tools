---
id: "858a1762-b233-4f71-aaac-e3ec2e2cd8f5"
type: "scenario"
label: "Failed fetch recorded"
given: "a git repository with a model folder whose CI runs keep artifacts with no test report in them, and gh answering for GitHub"
then: "it prints nothing and exits 2, and .state/ci-fetch.json says when, the commit HEAD was at, that it found none and that the artifacts of the run hold no test report; the second fetch records that it read the results of CI, with the run"
when: "radical check runs with --from-ci --quiet, then again after CI kept test reports"
---
