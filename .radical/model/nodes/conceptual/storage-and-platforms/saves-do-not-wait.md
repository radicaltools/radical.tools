---
id: "1ac15ab1-7ac7-44d0-b40f-75e7c4996d4b"
type: "scenario"
label: "Saves do not wait"
given: "a model with an edit made, a table view open over a canvas whose live layout has not settled"
then: "the save does not wait for the model to stop changing, and the layout behind the table moves nothing"
when: "the model keeps changing"
---
