---
id: "8b8e3425-b86b-49a1-bd18-5edf413426de"
type: "scenario"
label: "Completeness gaps found"
given: "a complete governance model with no relations left, a superseded and a half-written ADR, a fitness function without threshold and a requirement missing its trigger"
metrics: |
  test(packages/common/tests/check.test.ts › radical check › passes a complete model with no findings) passed
  test(packages/common/tests/check.test.ts › radical check › finds what each completeness rule is about, and points at the node file) passed
  test(packages/common/tests/check.test.ts › radical check › flags an ADR marked superseded only through the other ADR as well) passed
  test(packages/common/tests/check.test.ts › radical check › finds nothing to complete in a C4 model) passed
then: "it reports each completeness rule with the node file, warnings only so the check passes; a complete model and a C4 model give no findings, and an ADR superseded only through the other ADR is flagged"
when: "radical check runs on it"
---
