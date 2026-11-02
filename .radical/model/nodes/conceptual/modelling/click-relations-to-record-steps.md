---
id: "3cb01e62-2beb-4bc8-bc1b-bcc93ff847f4"
type: "requirement"
label: "Click relations to record steps"
action: "Studio shall append that relation as the next step of the sequence, even if it is already a step."
ears_type: "complex"
precondition: "a sequence is being edited"
rationale: "Scenarios are built from relations that already exist, so flows stay consistent with the structure. Evidence: packages/ui/src/components/Canvas.tsx:655-662, 821-845; packages/ui/src/store/diagramStore.ts:2505-2516; packages/ui/tests/sequences.test.ts:118-133; manual#view-flow"
trigger: "the user clicks a relation on the canvas"
---
