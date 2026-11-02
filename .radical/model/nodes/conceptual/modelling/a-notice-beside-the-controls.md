---
id: "f5e7db1e-a66c-412b-89fc-75b1b975e7a6"
type: "scenario"
label: "A notice beside the controls"
given: "a canvas with its controls at the bottom, and the pointer resting where notices appear"
metrics: "test(apps/e2e/tests/studio/notices.spec.ts › a notice stays clear of the canvas controls and goes under a resting pointer) passed"
then: "the notice stands above the canvas controls, clear of them, and goes after 5 s under the resting pointer; the one the pointer moved onto stays while it is there"
when: "Studio shows a notice, and later the user moves the pointer onto one"
---
