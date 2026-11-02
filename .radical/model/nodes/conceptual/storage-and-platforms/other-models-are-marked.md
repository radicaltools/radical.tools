---
id: "270f5f16-80fe-4f8a-90b7-5316b3b1affb"
type: "requirement"
label: "Other models are marked"
action: "the canvas shall draw it with a dashed outline, its properties card shall say which model and version it comes from and that it is read-only and show its fields without editing, and a table row and a wiki page shall name its model and offer no rename, no element inside it, no edit of its fields and no deletion"
ears_type: "state-driven"
precondition: "an element with an origin is shown"
rationale: "Which elements are this model's must be plain at a glance, in every view type, and an edit that would be refused should not be offered. Evidence: packages/ui/src/store/diagramStore.ts (the class rf-node-other-model on its canvas node), packages/ui/src/index.css (the dashed outline, .pp-other-model, .tv-origin), packages/ui/src/components/RightPanel.tsx (OtherModelNote; the card read-only for an element or relation with an origin), packages/ui/src/components/TableView.tsx (no F2 rename, no add row inside it, the model beside its name), packages/ui/src/components/WikiView.tsx (its page and its relations read-only, no write line under it, the menu without edits)"
---
