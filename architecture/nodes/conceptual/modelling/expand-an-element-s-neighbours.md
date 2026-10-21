---
id: "335abfe4-5d90-4065-90f2-1114842cc513"
type: "requirement"
label: "Expand an element's neighbours"
action: "the system shall add to the view every element related to it directly, by a relation in either direction and of any type, that the view does not show yet, drawn on its own without the frames of its ancestors, and lay the whole exploration out again top-down in layers by distance from the element it started from (the start on top, what its + added a layer below, and so on), a layer of more than eight elements wrapped into rows of at most eight; it shall draw only the relations between an element and the next layer, not those within a layer or across more than one layer; the camera shall then show the elements just added at a readable zoom (not below 60%), with the element they were added from in view; the + shall say how many of its neighbours are not shown yet and be gone when none are left"
ears_type: "event-driven"
rationale: "The user wants to see how the chosen element is connected to the others (\"I am only interested in how the selected element is related to others\"): every relation drawn lies on a shortest path from it, so frames and the relations within a layer are left out. One element's neighbours at a time keeps the view small enough to read. The exploration is temporary, so it is laid out again on each +; a view saved from it stands like any other (ADR A laid-out diagram stands)."
trigger: "the user clicks the + of an element in an explore view"
---
