---
id: "335abfe4-5d90-4065-90f2-1114842cc513"
type: "requirement"
label: "Expand an element's neighbours"
action: "the system shall add to the view every element related to it directly, by a relation in either direction and of any type, that the view does not show yet, each drawn inside the frames of its ancestors (a frame holds only what the exploration added), placed beside the element with the usual gap between siblings, without moving what the view shows except what a growing frame makes room for; the + shall say how many of its neighbours are not shown yet and be gone when none are left; a frame has a + of its own"
ears_type: "event-driven"
rationale: "One element's neighbours at a time keeps the view small enough to read."
trigger: "the user clicks the + of an element in an explore view"
---
