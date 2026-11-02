---
id: "2a00a8b6-3cd1-434d-bbc6-2921f2c21832"
type: "scenario"
label: "Deleted sequence unlinks view"
given: "a Flow view linked to a sequence"
metrics: "test(packages/ui/tests/sequences.test.ts › unlinks views that referenced the deleted sequence) passed"
then: "the Flow view still exists, has no linked sequence and shows the 'No sequence linked' hint"
when: "the user deletes the sequence"
---
