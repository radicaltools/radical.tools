---
id: "d2a63439-3948-44c2-be76-5a230e393ef1"
type: "requirement"
label: "Dialogs keep the keys"
action: "Studio shall leave the model and the page behind it alone on Ctrl/Cmd+Z, F5, ⌘P, ⌘+ and Alt+←, and keep Tab within the dialog"
ears_type: "state-driven"
precondition: "the Models, Hub import, AI providers or About dialog is open, or the focus is in Radical Forge"
rationale: "Undo, F5 and Back pressed in a dialog acted on the model or the page behind it, and Tab left the dialog for the canvas (exploratory runs 45 to 64, 2026-10-21, item 213). Evidence: apps/studio/src/renderer/src/components/ModalDialog.tsx, apps/studio/src/renderer/src/App.tsx (key handling)"
---
