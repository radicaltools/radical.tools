---
id: "5871fb0d-bcf4-41e4-910e-8444da1df46c"
type: "scenario"
label: "A frame round the part a view shows"
given: "a domain whose two entities stand at the right end of its 6800 px frame among the requirements and scenarios it also holds, and a view that shows the domain with only those entities"
then: "the frame wraps the two entities from its top left with its padding, the entities keep their places relative to each other, and a second run keeps the canvas as it is"
when: "Smart Layout lays out the view for the first time and finds no move to make"
---
