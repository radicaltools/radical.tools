---
id: "ccce21b9-f79d-42c9-9abf-c21611577a46"
type: "scenario"
label: "Viewer changes are thrown away"
gherkin: "# Covered by: apps/studio/tests/viewerSandbox.test.ts › viewer → designer restores c4Nodes from the snapshot"
given: "the user switched from Designer to Viewer and dragged and collapsed elements"
then: "the elements, positions and views are exactly as they were before entering Viewer"
when: "the user switches back to Designer"
---
