---
id: "02cffbc6-642e-4baa-bce7-6cd72653c212"
type: "scenario"
label: "Lines with room for their arrows"
given: "the author's view: a database 25 px beside the container it serves, an outside system touching the frame of the system that uses it, a queue nearly touching the system that writes to it, every line labelled 'uses'"
tests: |
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › every line keeps room for its label and arrowheads (the author's view, 2026-10-26)
  packages/layout/tests/tidy/tidy.test.ts › leaves nothing for a second run on a state machine view of the repository's own model (F-0107)
then: "every line, as drawn from port to port, is long enough for its label and an arrowhead at each end; on a state machine view a second run finds nothing left to do"
when: "Smart Layout tidies it"
---
