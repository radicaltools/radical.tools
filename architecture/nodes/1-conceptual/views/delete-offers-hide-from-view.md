---
id: "65ce27af-0aab-4dca-9c8f-10b9d5b8f78c"
type: "requirement"
label: "Delete offers hide from view"
action: "Studio shall offer to hide the elements from the current view instead of removing them from the model."
ears_type: "event-driven"
rationale: "Users often want an element out of one diagram, not out of the architecture. Evidence: packages/ui/src/components/DeleteConfirmDialog.tsx:10-77; packages/ui/src/store/diagramStore.ts:2648-2670; manual#views"
trigger: "the user deletes elements while a named view is active"
---
