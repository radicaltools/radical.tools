---
id: "3aadaa1f-e036-4e6e-8b47-2d0ac21dc66e"
type: "requirement"
label: "Continuous layout"
action: "Studio shall tidy the whole view, leave the pinned elements where they are, and glide the elements from where they were to their new places."
ears_type: "complex"
precondition: "continuous layout is on for the view shown on the canvas"
rationale: "While building a model the author adds element after element and had to run Smart Layout again and again; the diagram should keep itself arranged as it grows, with the movement shown so the eye can follow where things went (user request, 2026-10-26)."
trigger: "an element or relation is added to it, removed from it, moved to another parent, collapsed or expanded there, or an element is dropped on it, by the user or by an agent whose change Studio reloads"
---
