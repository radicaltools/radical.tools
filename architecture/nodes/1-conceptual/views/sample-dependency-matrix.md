---
id: "aa646c3c-eb0f-44ba-a37e-7f937975959b"
type: "scenario"
label: "Sample dependency matrix"
gherkin: "# Covered by: apps/e2e/tests/studio/views.spec.ts › Dependency Matrix (view-matrix)"
given: "the bundled Fintech sample is opened"
then: "the URL ends with /v/view-matrix and the matrix matches its screenshot baseline"
when: "the user opens the Dependency Matrix view"
---
