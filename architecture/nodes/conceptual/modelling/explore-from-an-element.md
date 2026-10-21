---
id: "65a85fe1-4737-4e69-9ecd-ce9a900caed8"
type: "requirement"
label: "Explore from an element"
action: "the system shall open a temporary structure view that shows only that element, in the middle of the canvas, with the menu of its + already open to choose the next level, list it first among the views, above All elements, as \"Explore: <the element's name>\", and keep it out of the saved document; in Designer its +, a drag and a fold on it are undo steps of their own that are never saved, so Undo on it first takes back what was last done there, and an edit of the model made on it is an ordinary undo step that comes back to it while it is open; in Viewer it explores the model shown, a milestone's when one is shown, follows a change of milestone, and makes no undo step"
ears_type: "event-driven"
rationale: "Finding what an element touches means building a view by hand or reading a large one; an exploration starts from the element and grows only where the user looks."
trigger: "the user chooses Explore from here on an element, from the selection bar or the element's context menu, in Designer or in Viewer"
---
