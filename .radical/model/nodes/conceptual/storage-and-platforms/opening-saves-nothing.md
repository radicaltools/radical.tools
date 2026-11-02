---
id: "22cc7b50-7772-43e7-8b6e-1eb48628bf74"
type: "scenario"
label: "Opening saves nothing"
given: "a folder model just opened in Designer, whose layout settles after the load"
then: "nothing is saved while only the layout settles; the edit or the moving step saves the model with what settled since; the reload does not write the view's camera as All elements'"
when: "the layout settles; then the user makes an edit, or a step that only moves (a drag, Smart Layout); and the model is reloaded with a view open"
---
