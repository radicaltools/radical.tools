---
id: "f7bf20b8-9baf-4c85-9da4-ddf93f457a98"
type: "requirement"
label: "Explore view discarded"
action: "the system shall discard the explore view without a question, leaving the document as it was and taking its own steps (its +, drags and folds) out of the undo history, the model's edits made on it staying there"
ears_type: "unwanted-behaviour"
rationale: "Settled 2026-10-21: an exploration is temporary unless saved."
unwanted_condition: "the user closes an explore view, starts another exploration, opens another model, switches to Presenter or the Inspector, or shows a milestone in Designer (a switch between Designer and Viewer, and the metamodel editor, keep it)"
---
