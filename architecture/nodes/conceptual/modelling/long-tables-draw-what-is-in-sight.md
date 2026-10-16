---
id: "34a18c59-c6ae-4811-86f7-ba53339decc5"
type: "requirement"
label: "Long tables draw what is in sight"
action: "Studio shall draw only the lines within the scrolled part of the table and 600 px around it, keep the scrolled height of all of them, and scroll to the row of an element that is selected elsewhere or added, when it is out of sight."
ears_type: "state-driven"
precondition: "a table view has 200 lines or more (rows and + rows)"
rationale: "A register of 750 requirements took a quarter of a second to open and blocked the UI for 280 ms; drawn by window it opens in about 0.1 s. A row is one line of text, so each kind of line has one height, measured as drawn. Evidence: packages/ui/src/components/TableView.tsx (useTableWindow, VIRTUAL_FROM, OVERSCAN_PX); apps/e2e/tests/studio/bench.spec.ts"
---
