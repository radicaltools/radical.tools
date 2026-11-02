---
id: "33298550-a87e-43b0-8116-33a625cac6cd"
type: "requirement"
label: "Undo and redo edits"
action: "Studio shall undo, or redo, the last model change and show it on the canvas it was made on, whichever canvas it is undone or redone from, whatever the letter's case (Shift held, or Caps Lock on), keeping up to 100 steps of history."
ears_type: "event-driven"
rationale: "Undo makes bold restructuring safe. The key was compared with a lower-case z, so Ctrl+Shift+Z as Windows and Linux send it did not redo, nor Ctrl+Z undo with Caps Lock on (F-0101, round 193–200, 2026-10-26). Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx:564-586,700-716; packages/ui/src/store/diagramStore.ts:115,131-135,3106-3137; packages/ui/tests/undo.test.ts:47-95; manual#shortcuts; manual#selection"
trigger: "the user presses ⌘/Ctrl+Z, or ⌘/Ctrl+Shift+Z or ⌘/Ctrl+Y"
---
