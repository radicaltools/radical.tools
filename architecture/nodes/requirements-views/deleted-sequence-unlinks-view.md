---
id: "2a00a8b6-3cd1-434d-bbc6-2921f2c21832"
type: "scenario"
label: "Deleted sequence unlinks view"
gherkin: "# Covered by: packages/ui/tests/sequences.test.ts › unlinks views that referenced the deleted sequence"
given: "a Flow view linked to a sequence"
then: "the Flow view still exists, has no linked sequence and shows the 'No sequence linked' hint"
when: "the user deletes the sequence"
---
