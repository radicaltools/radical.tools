---
id: "dd45e96b-fd5f-46f2-ada0-1c8a626598ad"
type: "scenario"
label: "Sample views layout cleanly"
gherkin: "And the canvas matches the reference screenshot for that view"
given: "the sample model is open on one of the views view-ctx, view-core, view-payments, view-screens or view-trace"
metrics: |
  test(apps/e2e/tests/studio/layout.spec.ts › sample view-ctx) passed
  test(apps/e2e/tests/studio/layout.spec.ts › sample view-core) passed
  test(apps/e2e/tests/studio/layout.spec.ts › sample view-payments) passed
  test(apps/e2e/tests/studio/layout.spec.ts › sample view-screens) passed
  test(apps/e2e/tests/studio/layout.spec.ts › sample view-trace) passed
then: "no siblings overlap and every child sits inside its parent"
when: "the user runs Smart Layout and the saved result is reopened"
---
