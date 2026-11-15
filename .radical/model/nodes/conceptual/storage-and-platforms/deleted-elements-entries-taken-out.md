---
id: "3483ef4d-5d7a-40f4-b29e-4f1e70d47001"
type: "scenario"
label: "Deleted elements' entries taken out"
given: "a repository whose .radical/radical.json maps a container and binds tests to a scenario, and holds the entry of an element the model no longer has"
then: "both entries are gone from the file and the answer says so; remove takes out the gone element's entry"
when: "an agent deletes the container and the scenario with delete_node, then calls set_verification with remove for the gone element"
---
