---
id: "61e01e62-128e-4d2c-babd-23af06fe7d54"
type: "scenario"
label: "Propagate to later milestones"
given: "milestone v1 is shown with an added sequence and v2 comes after it"
then: "v1, v2 and the live model all contain the added sequence; a note changed in v1 reaches the later models and the live one, each keeping the steps it added; an element moved into a parent a later model lacks stays where it is in that model"
when: "the user chooses Propagate"
---
