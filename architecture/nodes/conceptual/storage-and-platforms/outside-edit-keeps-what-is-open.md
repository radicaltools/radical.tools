---
id: "b4359e64-9960-4c0b-bff0-7a9fc9b953aa"
type: "scenario"
label: "Outside edit keeps what is open"
given: "a folder model open in Studio with a milestone shown and an edit not saved to it, or a presentation playing on its third slide, or a drag undone after the tab was hidden"
tests: |
  packages/ui/tests/outsideChangeUndo.test.ts › an outside change while a milestone is shown (item 126)
  packages/ui/tests/presentation.test.ts › the document read again after an outside change (item 136)
  apps/studio/tests/mdFolderWatch.test.ts › md-folder documents follow outside edits › lets a presentation play on through an outside edit, and reads the edit once it stops (item 136)
  apps/studio/tests/keptEdits.test.ts › edits kept for the next visit › keeps no edit that was undone after the tab was hidden (item 155)
then: "the milestone stays shown with its edit and the agent's change goes to the live model; the presentation plays on and Studio reads the change once it stops; the undone drag stays undone"
when: "an agent writes the folder (and, for the undone drag, the page is reloaded)"
---
