---
id: "895cb22f-31a9-48c0-9853-d0b48190f1d6"
type: "scenario"
label: "Inspector in place of the view"
given: "a folder model with a check report, open in Viewer"
then: "the left panel lists the Inspector's tabs and the tab picked stands in place of the view, with no section lit and no Inspector button in the toolbar; folding the left panel, by its chevron or by the lit button, leaves the report in place, and the button opens the panel again on the Inspector's tabs; Milestones goes back to the view with that section lit; ⌘J opens the Inspector again, on the tab picked after the reload too"
when: "the user presses the Inspector button on the rail, folds the left panel with its chevron, presses the lit button twice, picks the Milestones tab, then presses ⌘J and reloads the page"
---
