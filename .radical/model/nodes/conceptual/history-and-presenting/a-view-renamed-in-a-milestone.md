---
id: "cc667a6d-8e7e-4e20-952f-9d46d6ecba0c"
type: "scenario"
label: "A view renamed in a milestone"
given: "a milestone that shows a view its own way"
metrics: |
  test(packages/ui/tests/milestoneDeletedSince.test.ts › A view renamed while a milestone that shows it its own way is shown (F-0066) › a folder renamed holds every view of it, saved and back on the live model) passed
  test(packages/ui/tests/milestoneDeletedSince.test.ts › A view renamed while a milestone that shows it its own way is shown (F-0066) › a view renamed or moved to a folder keeps it, saved and back on the live model) passed
  test(packages/ui/tests/milestoneDeletedSince.test.ts › A view renamed while a milestone that shows it its own way is shown (F-0066) › a view renamed, and the milestone's edits propagated: the live view keeps the name) passed
then: "the live view takes the name and the folder: it is saved so, has them back on the live model and keeps them after Propagate, and the renamed folder holds every view of it"
when: "the user renames the view or its folder, or moves the view to a folder, while the milestone is shown; then leaves the milestone, or propagates the milestone's edits"
---
