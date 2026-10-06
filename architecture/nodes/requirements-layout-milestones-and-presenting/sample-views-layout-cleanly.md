---
id: "dd45e96b-fd5f-46f2-ada0-1c8a626598ad"
type: "scenario"
label: "Sample views layout cleanly"
gherkin: |
  And the canvas matches the reference screenshot for that view
  # Covered by: apps/e2e/tests/studio/layout.spec.ts › sample view-ctx, sample view-core, sample view-payments, sample view-screens, sample view-trace, sample canvas
given: "the sample model is open on one of the views view-ctx, view-core, view-payments, view-screens, view-trace or the canvas"
then: "no siblings overlap and every child sits inside its parent"
when: "the user runs Smart Layout and the saved result is reopened"
---
