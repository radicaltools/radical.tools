---
id: "d2a63439-3948-44c2-be76-5a230e393ef1"
type: "requirement"
label: "Dialogs keep the keys"
action: "Studio shall leave the model and the page behind it alone on Ctrl/Cmd+Z, F5, ⌘P, ⌘+ and Alt+←, let Delete and Esc reach neither the canvas nor the dialogs beneath, and keep Tab within the dialog; in an open menu, Delete and Esc shall not reach the canvas either, while F5, ⌘P and Ctrl/Cmd+Z close the menu and go on to Studio"
ears_type: "state-driven"
precondition: "the Models, Hub import, AI providers or About dialog, the Delete prompt or a node wizard is open, or the focus is in Radical Forge or an agent's run panel"
rationale: "Undo, F5 and Back pressed in a dialog acted on the model or the page behind it, and Tab left the dialog for the canvas (exploratory runs 45 to 64, 2026-10-21, item 213). The Delete prompt was no dialog to those keys: ⌘P switched the view behind it, F5 started a presentation under it and Ctrl/Cmd+Z undid a step (F-0171), and Delete pressed on a button of Radical Forge opened the canvas's Delete prompt under it (F-0173, round 211–220). One rule says who has the keys. Evidence: packages/ui/src/components/keysHere.ts (keysTakenElsewhere, keysOnTop), apps/studio/src/renderer/src/components/dialogKeys.ts (keysTakenByDialog), apps/studio/src/renderer/src/App.tsx (key handling)"
---
