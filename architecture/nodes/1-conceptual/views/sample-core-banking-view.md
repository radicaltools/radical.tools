---
id: "1fa24486-6578-4d5e-a3fb-babc0f3fe039"
type: "scenario"
label: "Sample Core Banking view"
gherkin: "# Covered by: apps/e2e/tests/studio/views.spec.ts › Core Banking (view-core)"
given: "the bundled Fintech sample is opened from the welcome screen"
then: "the URL ends with /v/view-core and the structure view matches its screenshot baseline"
when: "the user opens the Core Banking view"
---
