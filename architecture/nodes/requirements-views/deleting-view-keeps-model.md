---
id: "0c21598f-7ac3-4761-ba98-e64b8bea9e16"
type: "scenario"
label: "Deleting view keeps model"
gherkin: "# Not covered by an automated test"
given: "a named view showing three elements"
then: "the view disappears from the list, the default Structure view becomes active and all three elements are still in the model"
when: "the user deletes the view from its properties"
---
