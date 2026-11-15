---
id: "817ad0b0-d295-4699-b1d1-fec791bb4048"
type: "requirement"
label: "Offered edits are Designer's"
action: "Studio shall make it in Designer's model as one undo step and save it; from Viewer or Presenter it shall show Designer, and the Inspector shall stay open over the edited model; while Designer shows a milestone with edits not kept or dropped, an edit from the Inspector shall be refused, saying so"
ears_type: "event-driven"
rationale: "Viewer, Presenter and the Inspector show a model that is never saved. An edit made there was counted and drawn there, never saved, and gone in Designer (F-0132, F-0136, round 201–210). Evidence: packages/ui/src/store/designerEdit.ts (editAsDesigner, designerEditRefused)"
trigger: "the user makes an edit that the Inspector, Viewer or Presenter offers: a one-step fix of the Inspector (Add scenario, Add fitness function) or a concern pack's Add to model"
---
