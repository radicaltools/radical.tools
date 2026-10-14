---
id: "24af74f4-a9b1-4465-bc1a-abda902cc6a8"
type: "requirement"
label: "Filter the model tree"
action: "Studio shall show in the model tree only the elements whose label, description, technology or type matches, with their ancestors and the number of matches, and, while a named view is active, offer Show matches (the view lists exactly the matches), Hide matches (they leave the view) and Show all (the view shows the whole model again)."
ears_type: "event-driven"
rationale: "Building a view for an audience element by element is slow; the filter fills or trims a view in one step. Evidence: packages/ui/src/components/RightPanel.tsx (NodesFilterBar, RightPanel: nodeSearch, nodeTypeFilter, handleShowMatches, handleHideMatches, handleShowAllNodes)."
trigger: "the user types in Filter nodes… or picks element-type chips in the Nodes panel"
---
