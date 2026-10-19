---
id: "f954ae39-d304-4f62-8259-e5e342df6458"
type: "requirement"
label: "Explore sandbox restores Designer"
action: "Studio shall restore the elements, relations, views and positions that existed when the Designer perspective was left, and stay on the view shown at the moment of the switch (with its Designer layout), or on the view Designer had open when that view no longer exists."
ears_type: "event-driven"
rationale: "Dragging, collapsing or re-laying out during a review must leave no trace in the model; the view the user walked to is where they want to edit next (changed 2026-10-19 at the owner's request: before, Designer went back to the view it had left). Evidence: packages/ui/src/store/diagramStore.ts (setAppMode); apps/studio/tests/viewerSandbox.test.ts; packages/ui/tests/presenterMode.test.ts; apps/e2e/tests/studio/views.spec.ts; manual#presenting"
trigger: "the user returns to the Designer perspective from Viewer or Presenter"
---
