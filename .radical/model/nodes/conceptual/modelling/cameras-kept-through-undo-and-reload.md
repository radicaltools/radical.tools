---
id: "bbc2cdff-4358-41d3-9f00-434a83f0bb65"
type: "scenario"
label: "Cameras kept through Undo and reload"
given: "two views of a model in Designer, each with its camera moved, Smart fit off"
then: "Undo goes back to the first view with the cameras of both views as they were left; after the reload the view opens at the camera it had, and no model file was saved for the camera move; the model opens at that view's camera and keeps it after a reload; Designer opens the slide's view at its own camera, not the slide's, also after a reload; and Esc puts back the view and camera from before F5"
when: "the user makes a step on one view, switches to the other and presses Undo; and moves a view's camera alone and reloads the page; opens the model on a view from Models; shows a slide in Presenter and reloads; and presents with F5 from Designer, then presses Esc"
---
