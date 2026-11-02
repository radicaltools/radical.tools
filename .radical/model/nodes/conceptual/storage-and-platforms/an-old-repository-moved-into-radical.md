---
id: "068e6dd3-6437-49a7-a136-38832dedb35a"
type: "scenario"
label: "An old repository moved into .radical"
given: "a git repository with architecture/, radical.sensors.json, crucible.json and crucible/findings/ at its root and a .mcp.json naming architecture"
then: "--status warns about the old layout; the files are moved with git mv into .radical/ (the model to .radical/model), .mcp.json names .radical/model, and a new repository is offered .radical/model"
when: "radical setup runs and the move is accepted, and radical setup --status runs before it"
---
