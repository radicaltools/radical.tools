---
id: "1b370d2e-537a-42c3-96bc-30ecbbaebb1e"
type: "requirement"
label: "Create a named view"
action: "Studio shall create a view named 'View <n>' that shows the whole model, activate it and open its properties."
ears_type: "event-driven"
rationale: "Creating a new reading of the model must be one click away. Evidence: packages/ui/src/components/RightPanel.tsx:1107-1116; packages/common/src/model.ts:236-238; packages/ui/tests/views.test.ts:46-54; manual#views"
trigger: "the user clicks + New view"
---
