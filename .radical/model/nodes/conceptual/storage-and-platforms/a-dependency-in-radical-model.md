---
id: "cf558ebc-3001-422c-942e-a92de2676977"
type: "scenario"
label: "A dependency in .radical/model"
given: "a repository with its model in .radical/model, and a deps.json naming that folder as .radical/model, or as ./.radical/model/"
then: "the elements of that model are fetched, and the two ways of writing the folder name one model"
when: "radical federation fetch runs"
---
