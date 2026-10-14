---
id: "bec25c8b-bb05-49fa-856d-10af074bf37a"
type: "scenario"
label: "Labels of a large canvas placed fast, once"
given: "a canvas as large as the Structure view of radical.tools' own model, with 1400 labelled relations among 1600 node rects; and a small canvas whose React Flow state is handed over again without changes"
tests: |
  packages/layout/tests/edgeLabels.test.ts › placeEdgeLabels on a large canvas › places 1400 labels among 1600 nodes within 600 ms
  packages/ui/tests/edgeGeometry.test.ts › edgeGeometry
then: "the best of the three runs takes under 600 ms; the labels are placed once for the equal state and again for the moved node and for the longer label; with labels not shown none are placed and the paths stay the same, and showing them places them once however often the zoom goes in and out"
when: "the labels are placed, three times; and the edge geometry is asked for again with new but equal state, then with a moved node, then with a longer label; and with labels not shown, then shown, then hidden and shown again"
---
