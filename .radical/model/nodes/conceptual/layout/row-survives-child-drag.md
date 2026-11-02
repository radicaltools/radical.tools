---
id: "86d763b4-caee-4a90-9b38-f309388afd4d"
type: "scenario"
label: "Row survives child drag"
given: "a container and the element beside it are kept in a row on the Containers view"
metrics: "test(apps/e2e/tests/studio/alignment.spec.ts › dragging a child of an aligned container keeps the alignment) passed"
then: "the container grows, the element beside it follows, and the centres of both stay on one horizontal line during and after each drag"
when: "the user drags one of the container's children below its bottom edge and then above its top edge"
---
