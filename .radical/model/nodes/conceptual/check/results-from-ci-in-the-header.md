---
id: "201c41c3-b0e4-4f35-9994-8f3ee360eaf4"
type: "scenario"
label: "Results from CI in the header"
given: "test results downloaded from CI run 41192813920 of pull request #299, for a commit two before HEAD, and results read with --report"
metrics: |
  test(apps/studio/tests/inspectorOverview.test.ts › how old the evidence is › says the commit and run the results of CI come from) passed
  test(apps/studio/tests/inspectorOverview.test.ts › how old the evidence is › gives the commands that read them again for the model folder) passed
then: "it says From CI, pull request #299, run 41192813920, for commit 0023cdb (2 commits before HEAD), dates them by the run, not the download, and gives radical check <folder> --from-ci; results read with --report name the commit they were read at"
when: "the Inspector's Tests chip says where they come from"
---
