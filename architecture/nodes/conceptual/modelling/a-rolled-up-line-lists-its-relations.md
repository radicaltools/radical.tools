---
id: "9fe96ef8-ed64-4900-8b53-d68b27f24254"
type: "scenario"
label: "A rolled-up line lists its relations"
given: "a line drawn to a folded container for several relations, which use different technologies; and one for relations that all use one"
tests: |
  apps/e2e/tests/studio/edge-labels.spec.ts › a rolled-up line lists its relations one a line, without one relation's technology
  packages/ui/tests/rolledUpLabel.test.ts › A rolled-up line's label › lists its relations one a line, with no technology when they use different ones
  packages/ui/tests/rolledUpLabel.test.ts › A rolled-up line's label › shows the technology they all use
then: "each relation's name is on a line of its own; the first line shows no technology, the second the one they all use"
when: "the canvas draws them"
---
