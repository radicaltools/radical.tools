---
id: "9e5b0f8d-ccc4-4545-ad1c-c44612e0e473"
type: "scenario"
label: "Step back to v2 with diff"
gherkin: |
  And clicking v1 shows no diff, because the oldest milestone is the baseline
  # Covered by: packages/ui/tests/milestones.test.ts › v2 produces a diff against v1 (auto base = previous milestone)
given: "a model with milestones v1 and v2"
then: "the canvas shows the model as of v2, the chip names v2, and elements changed since v1 are coloured"
when: "the user clicks v2 in the Milestones list and turns on the diff toggle"
---
