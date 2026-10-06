---
id: "b479f0dd-6307-4a05-9a34-8d295964df00"
type: "requirement"
label: "Wizard Esc discards draft"
action: "Studio shall discard the draft and create nothing."
ears_type: "unwanted-behaviour"
rationale: "Cancelling must leave the model exactly as it was. Evidence: packages/ui/src/components/NodeWizard.tsx:124-134,147,200; packages/ui/src/store/diagramStore.ts:1561-1564; packages/ui/tests/nodeWizard.test.ts:130; manual#properties"
unwanted_condition: "the user presses Esc, clicks outside or closes a node wizard opened for a new element"
---
