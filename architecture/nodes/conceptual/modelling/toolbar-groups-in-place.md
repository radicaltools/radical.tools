---
id: "c01b2fa5-1a14-4f36-94f0-775a353b38c6"
type: "scenario"
label: "Toolbar groups in place"
given: "the bookstore System Context view in Designer"
tests: |
  apps/e2e/tests/studio/editing.spec.ts › the toolbar groups undo, navigation around Quick Search, and the branch's changes beside the perspectives
  apps/e2e/tests/studio/editing.spec.ts › at every window width down to the desktop app's narrowest, nothing in the toolbar lies on top of anything clickable
then: "Undo and Redo stand in one group after the logo, before the navigation; back and forward end within 16 pixels before Quick Search and History starts within 16 pixels after it; Changes on branch stands after History and before the perspective switch"
when: "the user looks at the toolbar"
---
