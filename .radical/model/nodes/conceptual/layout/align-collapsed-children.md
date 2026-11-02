---
id: "05f938fd-b7d8-4c9d-a741-8b77083c8123"
type: "scenario"
label: "Align collapsed children"
given: "a collapsed container is selected on the Containers view"
metrics: "test(apps/e2e/tests/studio/alignment.spec.ts › a collapsed container aligns its children, which line up when it is expanded) passed"
then: "Studio says its children line up when it is expanded, stores a row of its three children, and once expanded their centres lie on one horizontal line"
when: "the user chooses Align children → Keep in a row and then expands the container"
---
