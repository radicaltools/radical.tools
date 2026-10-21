---
id: "2f6cb317-0a90-4955-a53e-43d63f6288d9"
type: "scenario"
label: "Undo of a live step after a look at a milestone"
given: "a model in Designer with a step made on the live model, and a milestone"
tests: "packages/ui/tests/historyScope.test.ts › Undo of a live step after a look at a milestone"
then: "Undo takes back only the live step: the milestone made by Save as new, the renamed milestone and view and the added type stay; a milestone made on the live model is still taken back by its own Undo"
when: "the user opens the milestone, saves an edit in it as a new milestone, renames a milestone and a view and adds a type to the metamodel, goes back to the live model and presses Undo"
---
