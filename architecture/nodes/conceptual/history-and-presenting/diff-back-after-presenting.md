---
id: "0a3cb598-b880-4c3c-8d42-e9974dd727dd"
type: "scenario"
label: "Diff back after presenting"
given: "a milestone shown in Designer with its diff on"
tests: |
  packages/ui/tests/presentation.test.ts › Present and Esc with a milestone's diff on › gives the milestone's diff back
  packages/ui/tests/milestonePresenting.test.ts › names the milestone the slide draws, and none over the live model
  apps/e2e/tests/studio/milestones.spec.ts › a slide that plays the live model while a milestone is open names no milestone, and offers neither its diff nor Propagate
  apps/e2e/tests/studio/milestones.spec.ts › in Presenter, a slide card names the milestone its slide shows, and none over the live model
  packages/ui/tests/milestonePresenting.test.ts › of a slide that shows the live model names no milestone
  packages/ui/tests/milestonePresenting.test.ts › of a slide linked to another milestone names that one
  packages/ui/tests/milestonePresenting.test.ts › of a slide with its own copy names no milestone, and a milestone picked after it keeps the live model under it
then: "the milestone is shown again with its diff on"
when: "the user presents and ends the presentation with Esc"
---
