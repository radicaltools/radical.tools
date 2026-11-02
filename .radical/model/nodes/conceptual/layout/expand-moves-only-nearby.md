---
id: "1ba13e79-d7ae-4d9f-b0b3-8d1e16873457"
type: "scenario"
label: "Expand moves only nearby"
given: "a large model at rest of four systems, each with four containers of six components, related across systems"
then: "no element outside its system moves, and the canvas stays at rest afterwards; among many root elements the expand moves only what lies in the way and what that then lies on, outward, and leaves nothing on top of anything else, the opened container's own children set apart"
when: "the user collapses one container and expands it again; and expands a collapsed system among 24 to 100 root systems"
---
