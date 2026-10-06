---
id: "a74ff639-e4bb-4eb7-b597-ccd4742bd704"
type: "requirement"
label: "New model uses picked metamodel"
action: "Studio shall create an empty model in browser storage with the metamodel selected in the Welcome screen picker, C4 + DDD + Governance by default."
ears_type: "event-driven"
rationale: "The metamodel decides which element types and rules the model starts with. Evidence: apps/studio/src/renderer/src/components/WelcomeScreen.tsx:86-99,214-251; manual#getting-started"
trigger: "the user chooses New model on the Welcome screen"
---
