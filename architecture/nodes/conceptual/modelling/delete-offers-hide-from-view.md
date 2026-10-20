---
id: "65ce27af-0aab-4dca-9c8f-10b9d5b8f78c"
type: "requirement"
label: "Delete offers hide from view"
action: "Studio shall offer to hide the elements from the current view instead of removing them from the model, except on a view that lists no elements and shows what its filter gives, or a view of a group of views per element, where what it shows is changed through the filter or follows the element."
ears_type: "event-driven"
rationale: "Users often want an element out of one diagram, not out of the architecture. On a view whose filter decides what it shows, a hide wrote every other element into its list and froze it, so what was added later never showed there (exploratory run 27, 2026-10-20). Evidence: packages/ui/src/components/DeleteConfirmDialog.tsx; packages/ui/src/store/diagramStore.ts (hideRefusal, removeNodeFromView); apps/studio/src/renderer/src/components/SelectionActionBar.tsx; manual#views"
trigger: "the user deletes elements while a named view is active"
---
