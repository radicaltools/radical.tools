---
id: "1ba13e79-d7ae-4d9f-b0b3-8d1e16873457"
type: "scenario"
label: "Expand moves only nearby"
given: "a large model at rest of four systems, each with four containers of six components, related across systems"
tests: "apps/e2e/tests/studio/runs-13-24.spec.ts › expanding a container in a large nested model moves only what is around it, and stands"
then: "no element outside its system moves, and the canvas stays at rest afterwards"
when: "the user collapses one container and expands it again"
---
