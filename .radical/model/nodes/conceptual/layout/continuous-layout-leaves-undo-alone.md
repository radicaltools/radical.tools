---
id: "6fbd6c91-aabf-4020-97fc-680baa7bcd43"
type: "requirement"
label: "Continuous layout leaves undo alone"
action: "Studio shall leave the canvas as it is, and an add and the tidying it brought shall be one undo step."
ears_type: "unwanted-behaviour"
rationale: "A layout run after an undo would move what the undo just put back; a run after its own positions would never stop."
unwanted_condition: "an undo, a redo, a view switch, a drag still under way or a change of positions only changes the canvas while continuous layout is on"
---
