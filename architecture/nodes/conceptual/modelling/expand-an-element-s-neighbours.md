---
id: "335abfe4-5d90-4065-90f2-1114842cc513"
type: "requirement"
label: "Expand an element's neighbours"
action: "the system shall add to the view every element related to it directly, by a relation in either direction and of any type, that the view does not show yet, each drawn inside the frames of its ancestors (a frame holds only what the exploration added), and lay the whole exploration out again top-down in layers by distance from the element it started from (the start on top, what its + added a layer below, and so on), the frames holding their elements across layers, with the change animated; the + shall say how many of its neighbours are not shown yet and be gone when none are left; a frame has a + of its own"
ears_type: "event-driven"
rationale: "One element's neighbours at a time keeps the view small enough to read; a layered layout by distance shows the path the exploration took. The exploration is temporary, so it is laid out again on each +; a view saved from it stands like any other (ADR A laid-out diagram stands)."
trigger: "the user clicks the + of an element in an explore view"
---
