---
id: "74e1f02b-c50a-4a19-9306-2c402a759d19"
type: "scenario"
label: "Inspector with a milestone shown"
given: "Designer showing a milestone that holds an element the live model no longer has, and a model folder with test results"
then: "the Inspector checks the live model, its fixes waiting for it; the link says that the milestone shown lacks the element; Path is greyed out for the milestone's element, saying why; Designer shows its milestone all along"
when: "the user opens the Inspector, follows the link to an element of the live model and opens the card of the milestone's element"
---
