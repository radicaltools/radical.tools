---
id: "075b4f81-7180-4354-865b-67edca52b772"
type: "scenario"
label: "Blueprint import keeps views"
gherkin: "# Not covered by an automated test"
given: "Studio's Import from Hub dialog shows a blueprint"
then: "the picked elements are added and the blueprint's named views arrive prefixed with the blueprint name, holding only the picked elements"
when: "the user clicks Add to Model, unticks some elements and imports"
---
