---
id: "eb4239bc-10bb-4747-a679-7142b5112e9e"
type: "requirement"
label: "Wizard creates on finish"
action: "Studio shall create the element with the entered values and the relations picked in the wizard as a single undo step."
ears_type: "event-driven"
rationale: "Nothing half-filled should land in the model, and one undo should take the whole creation back. Evidence: packages/ui/src/components/NodeWizard.tsx:118-134,232-251; packages/ui/src/store/diagramStore.ts:1512-1525; packages/ui/tests/nodeWizard.test.ts:94,120; manual#properties"
trigger: "the user presses Create, or ⌘/Ctrl+Enter on any step, in a node wizard"
---
