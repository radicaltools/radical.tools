---
id: "f36dbc45-5c1f-4837-a38d-506d4c949418"
type: "scenario"
label: "A state machine tidied"
given: "a view of a state machine: an initial pseudostate, states joined by transitions and a final state, piled up"
tests: "packages/layout/tests/tidy/conventions.test.ts › a state machine: the start on top, the end at the bottom, transitions down"
then: "the initial pseudostate stands above every state, the final state below them, and no transition runs upward"
when: "Smart Layout tidies it"
---
