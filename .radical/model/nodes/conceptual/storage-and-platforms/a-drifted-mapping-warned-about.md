---
id: "e55c472a-8c17-4450-9130-d0b52e7194d5"
type: "scenario"
label: "A drifted mapping warned about"
given: "a .radical/radical.json with an entry for an element the model lacks, one whose name differs from the element's and one with a path the repository lacks"
then: "check warns about each of the three under repository-mapping; --status shows how many elements the file maps"
when: "radical check and radical setup --status run"
---
