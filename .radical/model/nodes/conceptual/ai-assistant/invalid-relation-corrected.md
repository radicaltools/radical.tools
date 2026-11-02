---
id: "ae095007-ad10-4651-bdcd-54fc9fb2aa65"
type: "scenario"
label: "Invalid relation corrected"
given: "the model asks for a relation type whose allowed pairs do not include the two element types"
then: "the call is rejected with the reason, no relation is added, and the model gets the error to retry with a valid call"
when: "the assistant runs that add_relation call"
---
