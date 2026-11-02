---
id: "e6f4a533-1239-42f4-a015-ed07980ff0f8"
type: "scenario"
label: "A typed name undone at once"
given: "Payment Provider selected, its properties card open"
then: "one Undo gives back \"Payment Provider\"; a field typed into again after it lost focus, or after Undo, is a new step; in the milestone what was typed before and after the question is one step, and another field typed into after it is a step of its own"
when: "the user types a new name letter by letter, leaves the field and presses Undo; and types a name in a milestone, answering the question about its edits between the letters"
---
