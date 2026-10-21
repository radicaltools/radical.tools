---
id: "719dacab-88c7-47d8-b041-e33a3f5ca289"
type: "scenario"
label: "Restore to live"
given: "a model with several milestones"
tests: |
  packages/ui/tests/perspectiveMilestones.test.ts › Restore to live
  packages/ui/tests/milestones.test.ts › restoreSnapshot › replaces c4Nodes/c4Relations with the snapshot content
  packages/ui/tests/milestones.test.ts › restoreSnapshot › takes the elements the milestone lacks out of the views, in the same undo step
  packages/ui/tests/milestones.test.ts › sequence versioning in milestones › restoreSnapshot restores sequences from the snapshot
then: "its elements, relations and sequences replace the live ones with no milestone shown, and the elements it lacks leave the views, as one undo step, also while another milestone is shown, asking first when that one has unkept edits"
when: "the user restores a milestone to live"
---
