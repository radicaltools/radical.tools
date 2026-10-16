---
id: "5f72c968-5bd0-45bb-afdb-da2ebd7e5069"
type: "scenario"
label: "Without a base, how to save one"
given: "a folder model without .radical/base.json, then with one saved two days ago on another branch, then with a malformed one"
tests: |
  apps/e2e/tests/studio/branch-changes.spec.ts › without a base the button says how to save one, and an old base is marked
  packages/common/tests/branchChanges.test.ts › base file
then: "without a base it is disabled and names radical hooks install and radical diff --save-base; with the old base the chip is marked and says when and on which branch it was saved; a malformed file counts as no base"
when: "the user looks at Changes on branch"
---
