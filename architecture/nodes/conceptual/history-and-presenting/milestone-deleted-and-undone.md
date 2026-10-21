---
id: "b3603651-5613-452e-9436-f5d1a28dd346"
type: "scenario"
label: "Milestone deleted and undone"
given: "a model with milestones, one of them shown on a slide"
tests: |
  packages/ui/tests/milestones.test.ts › removeSnapshot
  packages/ui/tests/milestoneViewEdits.test.ts › Undo in a milestone
  apps/e2e/tests/studio/milestones.spec.ts › a space typed into the name of a new milestone is part of the name
then: "the name keeps its space; making, renaming and deleting are each one undo step, so Undo of an earlier edit leaves the new milestone; the slide shows the live model while the milestone is deleted and the milestone again after Undo; with every edit undone the milestone has nothing unsaved, and Redo makes it unsaved again"
when: "the user makes a milestone typing a name with a space in it, renames one, deletes the one the slide shows, undoes the delete; and in a milestone undoes every edit made there, then redoes one"
---
