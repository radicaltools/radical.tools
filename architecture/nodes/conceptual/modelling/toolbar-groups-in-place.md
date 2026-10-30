---
id: "c01b2fa5-1a14-4f36-94f0-775a353b38c6"
type: "scenario"
label: "Toolbar groups in place"
given: "the bookstore System Context view in Designer"
metrics: |
  test(apps/e2e/tests/studio/editing.spec.ts › the toolbar groups the branch's changes with the model open, undo, and navigation around Quick Search) passed
  test(apps/e2e/tests/studio/editing.spec.ts › at every window width down to the desktop app's narrowest, nothing in the toolbar lies on top of anything clickable) passed
then: "Changes on branch stands in the strip of the model open, after its name; Undo and Redo stand in one group after that strip, before the navigation; back and forward end within 16 pixels before Quick Search and History starts within 16 pixels after it"
when: "the user looks at the toolbar"
---
