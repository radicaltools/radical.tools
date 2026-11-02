---
id: "902b5e8f-929b-4240-826c-e67ca67690ad"
type: "scenario"
label: "Distinct property keys"
given: "the Container type open in the metamodel editor"
then: "every property keeps a key of its own; \"type\" is refused with a note that it is a field every element has and the previous key stays, while \"typeOfBroker\" is accepted and saved"
when: "the user adds two properties, removes the first and adds another; or keys a property \"type\", then \"typeOfBroker\""
---
