---
id: "cb0835aa-decf-4ca4-a7f0-26f784a5ef3d"
type: "scenario"
label: "A repository laid out in .radical"
given: "a repository with .radical/model, .radical/sensors/sensors.json and .radical/crucible/crucible.json, and another laid out the old way (architecture/, radical.sensors.json at the root)"
then: "they use .radical/model and the files beside it, Studio opens that model; in the old repository architecture/ and radical.sensors.json"
when: "radical check, radical sense run and the MCP server run in a folder of it with no model folder named, and the repository itself is opened in Studio"
---
