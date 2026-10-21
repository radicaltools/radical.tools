---
id: "c4e8a773-8091-4e12-b08c-672b103b0251"
type: "scenario"
label: "Flow diff step by step"
given: "two milestones of a flow whose relation is used in two steps, the later one with one of those steps removed, one added, or a note changed, or the sequence new"
tests: |
  packages/ui/tests/sequences.test.ts › computeStepDiff (a flow view against the milestone before)
  apps/e2e/tests/studio/milestones.spec.ts › the diff of a flow view finds a step removed whose relation is another step too
then: "the removed second step is a faded ghost, an added second step is NEW, only the step whose note changed is CHANGED, and every step of a new sequence is NEW"
when: "the later milestone is shown on the flow view with its diff on"
---
