---
id: "ce6ba211-ba64-4252-bdf3-f1b043516bcc"
type: "requirement"
label: "Deleting view keeps elements"
action: "Studio shall remove only the view and keep all its elements and relations in the model."
ears_type: "event-driven"
rationale: "A view is a reading of the model, so removing it must never lose architecture content. Evidence: packages/ui/src/store/diagramStore.ts:2206-2219; packages/ui/src/components/RightPanel.tsx:953-955; packages/ui/tests/views.test.ts:192-215; manual#views"
trigger: "the user deletes a view"
---
