---
id: "868642d1-7bfa-45ae-9c5b-9521d5b80a2b"
type: "scenario"
label: "Physics placement survives reload"
given: "the bookstore Containers view"
metrics: "test(apps/e2e/tests/studio/physics.spec.ts › what the physics places inside a container is what a reload shows) passed"
then: "the canvas shows every element where the settled physics left it"
when: "the user drops a Container into Bookstore, waits until the live physics settles it, and reloads the page"
---
