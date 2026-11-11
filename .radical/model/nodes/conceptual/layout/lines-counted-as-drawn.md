---
id: "a9e33201-e136-438e-acd4-0da8126abad2"
type: "requirement"
label: "Lines counted as drawn"
action: "the system shall report, beside the reader's cost, how many lines cross and how many are drawn over an element as the canvas draws the lines (curved, led round the elements in their way), before and after the run."
ears_type: "event-driven"
rationale: "The moves are judged on straight lines from port to port; a line led round an element crosses others on its way round, so the judged count is lower than what the author sees. A report that says 17 crossings over a canvas that shows 49 is not one to trust."
trigger: "Smart Layout has tidied a view"
---
