---
id: "aa646c3c-eb0f-44ba-a37e-7f937975959b"
type: "scenario"
label: "Sample dependency matrix"
given: "the bundled Fintech sample is opened"
tests: "apps/e2e/tests/studio/views.spec.ts › Dependency Matrix (view-matrix)"
then: "the URL ends with /v/view-matrix and the matrix matches its screenshot baseline"
when: "the user opens the Dependency Matrix view"
---
