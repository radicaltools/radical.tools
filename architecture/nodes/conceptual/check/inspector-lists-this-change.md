---
id: "8e0e8781-4143-4132-b23f-c38b55b1bc03"
type: "scenario"
label: "Inspector lists this change"
given: "a folder model with a base and a test report, in which one new requirement's test passed, one's failed, one's scenario names a test the report lacks, a changed requirement's scenario did not change, and a removed requirement's test still ran"
metrics: |
  test(apps/e2e/tests/studio/branch-changes.spec.ts › the Inspector lists this change with what the tests say) passed
  test(packages/common/tests/branchChanges.test.ts › change status) passed
then: "This change lists them as verified, failing, test not written, check its tests and test still runs, counts 1 of 3 new verified, the tab's label says so, and Still to do hides the verified one"
when: "the user opens the Inspector's Implementation tab"
---
