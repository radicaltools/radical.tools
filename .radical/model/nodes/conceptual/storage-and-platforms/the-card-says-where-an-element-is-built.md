---
id: "8bf47a4a-1be5-4ac6-baf5-10bbb112fd46"
type: "scenario"
label: "The card says where an element is built"
given: "a repository whose .radical/radical.json maps a system to . and one of its containers to apps/api, opened in Studio by the repository, and again by its .radical/ folder"
then: "the container's card shows apps/api, the component's apps/api from the container, and the system's the radical implement command for it; the cards of the external system, of the person and of the requirement show no Built in"
when: "the user opens the cards of the container, of a component inside it, of a system of no entry, of an external system, of a person and of a requirement"
---
