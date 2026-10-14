---
id: "be8b40f8-71c6-4057-998f-877c65a8e7c0"
type: "scenario"
label: "Milestone holds the model"
given: "a model with elements, relations and sequences"
tests: |
  packages/ui/tests/milestones.test.ts › createSnapshot › deep-copies current nodes/relations into the new snapshot
  packages/ui/tests/milestones.test.ts › sequence versioning in milestones › createSnapshot captures current sequences
then: "the milestone has that name and a deep copy of the elements, relations and sequences, unchanged by later live edits"
when: "a milestone named test is created"
---
