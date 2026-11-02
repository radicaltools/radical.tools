---
id: "2bfaa659-fac1-4293-ab1e-4b3c593a0396"
type: "scenario"
label: "Saving while time-travelling"
gherkin: "And no milestone positions are written into the default or view positions"
given: "a milestone is shown on the canvas"
then: "the saved document holds the live model, not the milestone's content; opening and leaving the milestone writes nothing; leaving the page with unsaved edits of the milestone asks, and staying keeps them, while with nothing edited it asks nothing"
when: "the model is saved; a milestone is opened and left for the live model without an edit; the page is left while the milestone is shown, with and without unsaved edits"
---
