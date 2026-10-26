---
id: "bbc2cdff-4358-41d3-9f00-434a83f0bb65"
type: "scenario"
label: "Cameras kept through Undo and reload"
given: "two views of a model in Designer, each with its camera moved, Smart fit off"
tests: |
  packages/ui/tests/historyScope.test.ts › Undo and the canvas a step was made on › keeps the cameras of both views
  apps/e2e/tests/studio/selection-focus.spec.ts › a camera moved on its own survives a reload, and the model is not saved for it
  packages/ui/tests/reloadCamera.test.ts › a view opened while the model loads opens at its own camera
  apps/e2e/tests/studio/presentation.spec.ts › a slide shown in Presenter leaves the view's camera Designer's, also after a reload
  packages/ui/tests/presenterSlides.test.ts › a presentation started from Designer (F5) › ends at Designer's camera from before it started
then: "Undo goes back to the first view with the cameras of both views as they were left; after the reload the view opens at the camera it had, and no model file was saved for the camera move; the model opens at that view's camera and keeps it after a reload; Designer opens the slide's view at its own camera, not the slide's, also after a reload; and Esc puts back the view and camera from before F5"
when: "the user makes a step on one view, switches to the other and presses Undo; and moves a view's camera alone and reloads the page; opens the model on a view from Models; shows a slide in Presenter and reloads; and presents with F5 from Designer, then presses Esc"
---
