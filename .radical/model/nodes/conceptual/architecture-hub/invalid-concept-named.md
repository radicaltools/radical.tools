---
id: "c12aa323-7eb4-417d-9ae7-81bc9389e34e"
type: "scenario"
label: "Invalid concept named"
given: "the Hub catalogue, and two concept files with a wrong path and an unknown hubRef"
metrics: |
  test(packages/hub-catalogue/tests/catalogue.test.ts › hub catalogue › contains concepts and passes validation) passed
  test(packages/hub-catalogue/tests/catalogue.test.ts › hub catalogue › flags path / id mismatches and dangling hubRefs) passed
then: "the real catalogue passes, and the errors name the path the concept should have and the unknown concept"
when: "the catalogue is validated"
---
