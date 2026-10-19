---
id: "04352eed-602f-4f1b-819e-54e6a6d86b8d"
type: "requirement"
label: "Forge makes groups of views"
action: "Radical Forge shall make, for each chosen viewpoint that draws one element, its group (named after the viewpoint, in its folder Conceptual or Logical) once the model has an element of its types that is not external, report and offer to arrange the group's views that show the stage's new elements, and leave the whole-model viewpoints Containers, Components, Process (Warnier) and Domain model unticked unless the user ticks them."
ears_type: "event-driven"
rationale: "A run with several state machines, processes, systems or domains reads one at a time, and an element a later stage or a hand edit adds joins its group by itself. Evidence: packages/common/src/ai/forge/views.ts (fileIntoGroup, RADICAL_FOLDERS, forgeStageView, forgeArrangeGroups), apps/mcp/src/forge.ts"
trigger: "a Forge run with the Radical structure stores its need or completes a stage"
---
