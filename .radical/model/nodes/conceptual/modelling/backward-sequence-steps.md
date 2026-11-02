---
id: "03c244db-af29-4d29-ba90-2cb2f18158dd"
type: "requirement"
label: "Backward sequence steps"
action: "The system shall play that step from its relation's target to its source, as a response, in Flow views (drawn dashed) and in Presenter, number it at the target end on the canvas (↩), make turning it one undo step, report it in GET SEQUENCE and count a turned step as a change in a milestone comparison, and keep the mark (stepBackward in sequences.json) with its step when the model is saved, merged, edited in a milestone or imported from Structurizr; a file without marks reads as all steps forward."
ears_type: "event-driven"
rationale: "A sequence played every step along its relation, so a response (the answer going back along the same call) could not be drawn without a second relation the other way, and a Structurizr dynamic step against its relationship was left out (exploratory runs 65 to 69, 2026-10-21). Evidence: packages/common/src/c4.ts (DiagramSequence.stepBackward, isBackwardStep, trimStepBackward); packages/common/src/ai/tools/sequenceTools.ts; packages/common/src/modelMerge.ts (STEP_KEYS, mergeSteps); packages/common/src/formats/structurizrDsl.ts; packages/ui/src/store/diagramStore.ts (setStepBackward, computeStepDiff); packages/ui/src/components/RightPanel.tsx; apps/studio/src/renderer/src/components/SequenceView.tsx; packages/ui/src/components/edges/RelationEdge.tsx; manual#view-flow"
trigger: "a sequence step is marked as backward: turned with ⇄ (Run the other way, as a response) on the step in Studio, given `backward` in create_sequence or update_sequence, or imported from a Structurizr dynamic step that runs against its relationship's direction"
---
