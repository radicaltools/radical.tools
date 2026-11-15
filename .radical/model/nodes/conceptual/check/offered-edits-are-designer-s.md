---
id: "817ad0b0-d295-4699-b1d1-fec791bb4048"
type: "requirement"
label: "Offered edits are Designer's"
action: "Studio shall make it in Designer's model as one undo step and save it, listing nothing in the view Designer has open: a concern pack imported from Viewer, Presenter or the Inspector is listed only in its own view in the folder Concerns, which Designer opens when Studio stays there; what the edit offers to pick shall come from the model it goes into, Designer's, not from a milestone or slide the perspective shows, and an element that model lacks shall be refused, never dropped; from Viewer or Presenter it shall show Designer, with the Inspector still open"
ears_type: "event-driven"
rationale: "Viewer, Presenter and the Inspector show a model that is never saved. An edit made there was counted and drawn there, never saved, and gone in Designer (F-0132, F-0136, round 201–210). Evidence: packages/ui/src/store/designerEdit.ts (editAsDesigner, designerEditRefused). A pack imported from the Inspector went into the view Designer had open (F-0166), and Import from Hub in Viewer showing a milestone offered and ticked an element only the milestone had, then bound the pack to nothing without a word (F-0167, round 211–220). Evidence also: designerEditModel; apps/studio/src/renderer/src/hub/importConcept.ts (importConcernPackIntoDiagram)"
trigger: "the user makes an edit that Viewer or Presenter, or the Inspector open in either, offers: a one-step fix of the Inspector (Add scenario in Designer, Add fitness function in Designer) or a concern pack's Add to model"
---
