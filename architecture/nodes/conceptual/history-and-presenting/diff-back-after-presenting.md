---
id: "0a3cb598-b880-4c3c-8d42-e9974dd727dd"
type: "scenario"
label: "Diff back after presenting"
given: "a milestone shown in Designer with its diff on"
tests: |
  packages/ui/tests/presentation.test.ts › Present and Esc with a milestone's diff on › gives the milestone's diff back
  packages/ui/tests/milestonePresenting.test.ts › names the milestone the slide draws, and none over the live model
  apps/e2e/tests/studio/milestones.spec.ts › a slide that plays the live model while a milestone is open names no milestone, and offers neither its diff nor Propagate
then: "the milestone is shown again with its diff on"
when: "the user presents and ends the presentation with Esc"
---
