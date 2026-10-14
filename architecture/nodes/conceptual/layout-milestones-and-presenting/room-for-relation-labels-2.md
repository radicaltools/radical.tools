---
id: "eb122bd1-0caf-43b0-9176-7a7da5a23a88"
type: "requirement"
label: "Room for relation labels"
action: "Smart Layout shall keep two elements joined by a labelled relation (or their ancestors that are siblings) far enough apart for the label and a 10 px margin on each side of it to fit between them, along the axis on which they sit apart, and count every labelled relation whose ends leave no such room as a cost."
ears_type: "ubiquitous"
rationale: "Layout keeps only 40 px between root elements and 20 px between siblings, far less than a label (about 32 px tall, up to 200 px wide), so labels of relations between neighbours had nowhere to go but over an element. The pair gaps are applied when a layout is finalised and in the annealer, and labelCrowding is a term of the composite score; relations from an element to its own ancestor need none. Evidence: packages/layout/src/labelRoom.ts, packages/layout/src/layoutFinalize.ts (separateBoxes pairGap), packages/layout/src/smartLayout.ts (labelCrowding, W_LABEL in scoreWeights.ts), packages/layout/tests/labelRoom.test.ts"
---
