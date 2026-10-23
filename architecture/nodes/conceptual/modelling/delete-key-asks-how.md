---
id: "bcde343d-1b42-45bb-b0a8-b9241d458fea"
type: "requirement"
label: "Delete key asks how"
action: "Studio shall ask whether to remove them from the model, saying what that takes with them (the elements inside, the relations and the sequence steps that go), hide them from the current view (relations alone too), or cancel; a line that stands for relations of what lies inside a folded container, or of what an element the view shows holds, is asked about as those relations, named in the prompt, Remove from model removing them and Hide from current view hiding them from the view."
ears_type: "event-driven"
rationale: "A keyboard delete is easy to trigger by accident, and often the user only wants the element out of one view. Delete on a rolled-up line asked \"Delete 1 element?\" with nothing counted, and Remove from model removed nothing (run 184, 2026-10-23, F-0055). Evidence: packages/ui/src/components/Canvas.tsx:930,952; packages/ui/src/store/diagramStore.ts:2571-2585,2622-2633,2648-2672 (onEdgesChange, resolvePendingDelete); packages/ui/src/components/DeleteConfirmDialog.tsx (deletePromptTitle); manual#selection; manual#shortcuts"
trigger: "the user presses Delete with nodes or relations selected on the canvas"
---
