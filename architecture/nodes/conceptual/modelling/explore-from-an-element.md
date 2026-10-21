---
id: "65a85fe1-4737-4e69-9ecd-ce9a900caed8"
type: "requirement"
label: "Explore from an element"
action: "the system shall open a temporary structure view that shows only that element, list it first among the views as \"Explore: <the element's name>\", and keep it out of the saved document and out of the model's undo history; in Viewer it explores the model shown, a milestone's when one is shown, and follows a change of milestone; in Designer showing a milestone closes it"
ears_type: "event-driven"
rationale: "Finding what an element touches means building a view by hand or reading a large one; an exploration starts from the element and grows only where the user looks."
trigger: "the user chooses Explore from here on an element, from the selection bar or the element's context menu, in Designer or in Viewer"
---
