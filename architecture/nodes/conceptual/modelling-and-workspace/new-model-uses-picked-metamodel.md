---
id: "a74ff639-e4bb-4eb7-b597-ccd4742bd704"
type: "requirement"
label: "New model uses picked metamodel"
action: "Studio shall create an empty model with the metamodel picked in the New model step, the Radical metamodel by default, kept where the user chose: in the browser, a file or a folder."
ears_type: "event-driven"
rationale: "The metamodel decides which element types and rules the model starts with. Evidence: apps/studio/src/renderer/src/components/ModelSteps.tsx (NewModelStep); apps/e2e/tests/studio/boot.spec.ts; manual#getting-started"
trigger: "the user chooses New model on the Welcome screen"
---
