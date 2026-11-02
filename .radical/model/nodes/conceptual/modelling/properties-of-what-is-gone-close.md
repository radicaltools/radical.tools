---
id: "b77d3b47-4b13-4dba-9453-2d12edb22f5a"
type: "requirement"
label: "Properties of what is gone close"
action: "Studio shall go back to the list instead of showing empty properties."
ears_type: "unwanted-behaviour"
rationale: "Undoing a new view left the pane open on nothing but ◀ Back. Evidence: packages/ui/src/components/RightPanel.tsx (LeftPanel paneGone)"
unwanted_condition: "the view, milestone or folder whose properties the left panel shows no longer exists (an undo, a delete, an edit made outside)"
---
