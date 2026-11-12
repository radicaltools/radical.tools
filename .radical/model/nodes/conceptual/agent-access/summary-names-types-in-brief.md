---
id: "a63d53ee-9a75-4857-aafa-09f152452a1a"
type: "scenario"
label: "Summary names types in brief"
given: "a folder with the Radical metamodel"
then: "the first answer is under 15,000 characters and gives requirement in one line with its property keys and ears_type's options, and says that types gives a type in full; the second gives requirement's and constrains' whole definitions only and names unknown-type as unknown"
when: "an agent calls get_model_summary, then get_model_summary with types [\"requirement\", \"constrains\", \"unknown-type\"]"
---
