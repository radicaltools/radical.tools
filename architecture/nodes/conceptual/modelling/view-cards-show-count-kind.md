---
id: "a7464ac4-e765-4073-af21-7e0bc1782c8e"
type: "requirement"
label: "View cards show count, kind"
action: "Studio shall show each view in the view list as a card with its name, the number of elements it shows (what its filter's chain gives, else the elements it lists, or All nodes when it shows the whole model) and its kind."
ears_type: "ubiquitous"
rationale: "Users must be able to tell views apart before opening them; a view built by a filter lists no elements, so a count of its list would say All nodes on every such view. The count follows the model a moment after it stops changing, since running every view's chain takes tens of milliseconds on a large model. Evidence: packages/ui/src/components/RightPanel.tsx (useViewNodeCounts, ViewList); packages/common/src/viewPipeline.ts (viewShownNodes); manual#views"
---
