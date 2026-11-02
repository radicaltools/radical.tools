---
id: "ead4cd36-5550-46dd-8f7b-39d7435d12ae"
type: "requirement"
label: "No undo while exploring"
action: "ignore the undo keys for the Designer perspective's steps, leaving the model and the saved model unchanged, and keep those steps for undo after the user returns to Designer"
ears_type: "state-driven"
precondition: "the Viewer or Presenter perspective is active"
rationale: "Exploring must not change or lose the model being designed. Evidence: apps/e2e/tests/studio/editing.spec.ts"
---
