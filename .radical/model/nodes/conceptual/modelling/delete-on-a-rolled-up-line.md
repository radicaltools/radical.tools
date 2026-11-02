---
id: "131e3c17-c98a-4140-a284-bddf67c75ecc"
type: "scenario"
label: "Delete on a rolled-up line"
given: "a view of a person, a folded system holding two containers and a second system, where the lines from the person and to the second system stand for relations of the containers"
metrics: |
  test(packages/ui/tests/deleteRolledUpLine.test.ts › Delete on a rolled-up line › asks about the relation it stands for, named, and Remove from model removes it) passed
  test(packages/ui/tests/deleteRolledUpLine.test.ts › Delete on a rolled-up line › standing for two relations, names both and removes both) passed
  test(packages/ui/tests/deleteRolledUpLine.test.ts › Hide from current view on a line › hides the relations it stands for from the view, and keeps them in the model) passed
then: "the prompt names the relation the line stands for, or both of them, and Remove from model removes them, Undo bringing them back; Hide from current view hides them from the view and keeps them in the model"
when: "the user presses Delete on the line to the second system, and on the line from the person, which stands for two relations, and chooses Remove from model; and on the line to the second system chooses Hide from current view"
---
