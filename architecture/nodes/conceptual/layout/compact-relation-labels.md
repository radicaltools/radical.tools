---
id: "9e78e63f-48bb-4be3-ab03-9cf858beaabb"
type: "requirement"
label: "Compact relation labels"
action: "The canvas shall draw a relation's name at 12 px on at most two lines and its technology at 10 px on one line, in a box at most 160 px wide, cutting longer text with an ellipsis and showing the whole of it while the relation is hovered or selected or an element at one of its ends is selected; and Smart Layout shall leave room for labels of that size."
ears_type: "ubiquitous"
rationale: "At 17 px, larger than the elements' names, and wrapped without limit, long relation names (\"reads and writes the Markdown folder writes .radical/forge-run.json beside\") took four or five lines and covered the diagram. Layout and canvas measure labels the same way (estimateLabelSize with each line's maxRows), so the room Smart Layout keeps matches what is drawn. Evidence: packages/layout/src/edgeLabels.ts (RELATION_LABEL_BOX, relationLabelLines, estimateLabelSize), packages/ui/src/components/edges/RelationEdge.tsx, packages/ui/src/index.css (.relation-label-name, .relation-label-tech)"
---
