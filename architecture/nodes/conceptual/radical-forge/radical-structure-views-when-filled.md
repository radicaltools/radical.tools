---
id: "6994c3bf-c6c7-4cdd-ba2f-ed0b6b5a6179"
type: "requirement"
label: "Radical structure views when filled"
action: "Radical Forge shall create, in its folder, a view of each chosen viewpoint that the model has no view of yet and whose filter now shows at least one element, reuse the model's view of a viewpoint where there is one, show the view the stage fills first, and offer to arrange the canvas views among them that show the stage's new elements."
ears_type: "event-driven"
rationale: "An empty view of a viewpoint the run never fills (Entity lifecycles in a model without state machines) is noise; views of viewpoints list no elements, so a later run or a hand edit shows up in them by itself. Evidence: packages/common/src/ai/forge/views.ts (fileIntoForgeViews); RadicalForgeModal.tsx (runStage, ensureNeed); apps/mcp/src/forge.ts (forge_start, forge_complete_stage, placeInViews)"
trigger: "a Forge run with the Radical structure stores its need or completes a stage"
---
