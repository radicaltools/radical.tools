---
id: "bcde343d-1b42-45bb-b0a8-b9241d458fea"
type: "requirement"
label: "Delete key asks how"
action: "Studio shall ask whether to remove them from the model, hide them from the current view (only with a named view active and nodes selected) or cancel."
ears_type: "event-driven"
rationale: "A keyboard delete is easy to trigger by accident, and often the user only wants the element out of one view. Evidence: packages/ui/src/components/Canvas.tsx:930,952; packages/ui/src/store/diagramStore.ts:2571-2585,2622-2633,2648-2672; packages/ui/src/components/DeleteConfirmDialog.tsx:9-77; manual#selection; manual#shortcuts"
trigger: "the user presses Delete with nodes or relations selected on the canvas"
---
