---
id: "b4359e64-9960-4c0b-bff0-7a9fc9b953aa"
type: "scenario"
label: "Outside edit keeps what is open"
given: "a folder model open in Studio with a milestone shown and an edit not saved to it, or a presentation playing on its third slide, or a drag undone after the tab was hidden, or a sequence's card open, or a relation's card open with text being typed into it, or a wiki page title clicked into with nothing typed"
tests: |
  packages/ui/tests/outsideChangeUndo.test.ts › an outside change while a milestone is shown (item 126)
  packages/ui/tests/outsideChangeUndo.test.ts › an outside change while a sequence is open
  packages/ui/tests/presentation.test.ts › the document read again after an outside change (item 136)
  apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › lets a presentation play on through an outside edit, and reads the edit once it stops (item 136)
  apps/studio/tests/keptEdits.test.ts › edits kept for the next visit › keeps no edit that was undone after the tab was hidden (item 155)
  apps/studio/tests/changeFlash.test.ts › outside changes flash › compares with the live model when the milestone shown with unsaved edits was deleted outside
  apps/e2e/tests/studio/folders.spec.ts › an agent's write leaves the sequence card open
  apps/e2e/tests/studio/folders.spec.ts › an outside write keeps the selected relation's card open, and what is typed in it
  apps/e2e/tests/studio/wiki.spec.ts › wiki text opened before an agent's edit takes the edit, and leaving it writes nothing
  apps/e2e/tests/studio/folders.spec.ts › an outside write during a drag waits for the drop, and the drop lands under the pointer
  apps/studio/tests/mdFolderWatch.test.ts › takes an outside edit in at the drop of a drag held when it came
then: "the milestone stays shown with its edit and the agent's change goes to the live model, and when the agent deletes that milestone the highlight compares with the live model; the presentation plays on and Studio reads the change once it stops; the undone drag stays undone; the sequence card stays open unless the sequence is gone; the relation's card stays open with its focus and what was typed; the wiki text shows the agent's edit, and leaving it writes nothing"
when: "an agent writes the folder (and, for the undone drag, the page is reloaded)"
---
