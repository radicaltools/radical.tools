---
id: "22cdc4c2-842e-445e-a736-5fe055b53897"
type: "requirement"
label: "End restores the model"
action: "Studio shall restore the model and the active view from before the presentation and restart the live layout."
ears_type: "event-driven"
rationale: "Slides swap model copies onto the canvas, so the real model must come back afterwards. Evidence: packages/ui/src/store/diagramStore.ts:3835-3857; packages/ui/tests/presentation.test.ts:117-137; apps/e2e/tests/studio/presentation.spec.ts:32-36"
trigger: "the presentation ends"
---
