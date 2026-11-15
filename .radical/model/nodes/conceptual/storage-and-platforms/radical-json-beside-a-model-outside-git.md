---
id: "d9b7bc18-42a6-450b-af47-f04d3383e534"
type: "scenario"
label: "radical.json beside a model outside git"
given: "a model folder outside any git repository, with no .radical/radical.json"
then: "the file is written in .radical/ beside the model folder, and the MCP server reads that entry"
when: "radical implement maps an element, and the MCP server reads the mapping"
---
