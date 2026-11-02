---
id: "e87cb07c-8f54-47da-92f7-24edc10bc687"
type: "scenario"
label: "Presenting leaves Designer alone"
given: "a presentation with hierarchy and Warnier slides, started with F5 from Designer or from Presenter, with an element selected"
then: "drilling changes nothing in Designer and leaves no element in the address, a click selects nothing, the Warnier slide cannot be edited, so Undo after Exit has nothing of it; Esc ends the presentation with an element selected and F5 stops one F5 started, leaving Designer's views as they were; Viewer shows the view as Designer has it and Designer gets its camera back; the relation's end handles show in Designer only; the element selected before is not selected on the slides, and is selected again when the presentation ends"
when: "the presenter drills the hierarchy slide, clicks on it, selects an element on the Warnier slide, tries to edit it, presses Esc or F5, then switches from Presenter to Viewer and back to Designer, and in Designer selects a relation"
---
