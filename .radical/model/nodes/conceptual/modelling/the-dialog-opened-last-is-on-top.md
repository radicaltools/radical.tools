---
id: "28276dce-4fb9-48d3-86a5-1adc3c95bf19"
type: "requirement"
label: "The dialog opened last is on top"
action: "Studio shall draw the dialog opened last over the others, its buttons within reach, and let Esc close it alone"
ears_type: "event-driven"
rationale: "Radical Forge's panel had a layer of its own over the Delete prompt, Models, AI providers and About opened after it: none of their buttons could be clicked, and Esc closed Forge with the dialog over it (F-0168, round 211–220). Dialogs and run panels share one layer in the page's body, and only the one on top answers Esc. Evidence: packages/ui/src/components/keysHere.ts (keysOnTop), apps/studio/src/renderer/src/studio.css and packages/ui/src/index.css (--z-dialog)"
trigger: "the user opens a dialog (the Delete prompt, Models, AI providers or About) while Radical Forge's panel, an agent's run panel or another dialog is open"
---
