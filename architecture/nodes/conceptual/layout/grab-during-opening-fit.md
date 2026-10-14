---
id: "05998ce7-4a4b-42d4-9b5d-d0c3e9e480f4"
type: "scenario"
label: "Grab during opening fit"
given: "the Containers view just opened, while Smart fit is still framing it"
tests: "apps/e2e/tests/studio/physics.spec.ts › an element grabbed right after a view opens stays under the pointer"
then: "the element ends under the pointer where it was let go, at about its size"
when: "the user drags the Payments element 60 px right and 120 px down"
---
