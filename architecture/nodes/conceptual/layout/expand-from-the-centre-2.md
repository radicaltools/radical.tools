---
id: "fc2cec37-4c33-4722-b905-bafa81611956"
type: "scenario"
label: "Expand from the centre"
given: "the Bookstore container collapsed on the Containers view"
tests: "apps/e2e/tests/studio/physics.spec.ts › an expanded element grows around the centre of its collapsed box"
then: "the first frame drawn at the expanded size keeps the box centred where the collapsed box was"
when: "the user expands it"
---
