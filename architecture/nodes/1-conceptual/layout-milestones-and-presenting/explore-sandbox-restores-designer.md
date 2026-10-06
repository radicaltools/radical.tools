---
id: "f954ae39-d304-4f62-8259-e5e342df6458"
type: "requirement"
label: "Explore sandbox restores Designer"
action: "Studio shall restore the elements, relations, views, positions and active view that existed when the Designer perspective was left."
ears_type: "event-driven"
rationale: "Dragging, collapsing or re-laying out during a review must leave no trace in the model. Evidence: packages/ui/src/store/diagramStore.ts:3583-3656; apps/studio/tests/viewerSandbox.test.ts:66-193; packages/ui/tests/presenterMode.test.ts:73-175; manual#presenting"
trigger: "the user returns to the Designer perspective from Viewer or Presenter"
---
