---
id: "5f72c968-5bd0-45bb-afdb-da2ebd7e5069"
type: "scenario"
label: "Without a base, how to save one"
given: "a folder model without .radical/base.json, then with one saved two days ago on another branch, then with a malformed one"
metrics: |
  test(apps/e2e/tests/studio/branch-changes.spec.ts › without a base the button says how to save one, and an old base is marked) passed
  test(packages/common/tests/branchChanges.test.ts › base file) passed
then: "without a base the button shows no count and opens the commands radical hooks install and radical diff --save-base; with the old base its count is marked, and the Inspector's Changes tab says when and on which branch it was saved and how to save it again; a malformed file counts as no base, and with neither a base nor a report the Inspector is greyed out"
when: "the user looks at Changes on branch"
---
