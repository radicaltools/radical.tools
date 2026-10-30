---
id: "b347586a-fb53-4973-9296-e17ce2999335"
type: "scenario"
label: "Undo after an outside change"
given: "a folder model open in Studio's Designer, where the user renamed an element"
metrics: |
  test(packages/ui/tests/outsideChangeUndo.test.ts › Undo after an outside change) passed
  test(apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › keeps Undo after an outside edit: it takes back the user's edit, not the agent's) passed
  test(apps/e2e/tests/studio/folders.spec.ts › Undo after an outside edit takes back the user's edit and keeps the outside one) passed
  test(packages/ui/tests/outsideChangeUndo.test.ts › puts the deleted elements back clear of what the outside change put there since) passed
then: "Undo takes back the rename and the outside change stays, on the canvas and in the folder; Redo gives the rename back; where the step and the outside change touched the same value, the outside value stays and a notice says so; an add or a New view is taken back after the folder's round trip, with no notice, but an add the agent has built on since (a child added into it, a relation drawn to it) keeps the element with what the agent built, and a notice says so; a name typed while the agent writes is one step; Undo of Keep in a row puts the row back exactly where it stood; the history outlives an outside change while the Inspector, the metamodel editor, Viewer or Presenter is open; what a step would bring back that needs an element or a type deleted outside (a relation to it, an element inside it) stays out, and a notice names it; loading another model still forgets the history"
when: "an agent (or an editor) changes another element in the folder, Studio reloads, and the user presses Undo, then Redo"
---
