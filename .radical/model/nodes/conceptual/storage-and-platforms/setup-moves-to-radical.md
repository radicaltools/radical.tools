---
id: "aad5d2af-06e6-428e-bf64-96472564166b"
type: "requirement"
label: "Setup moves to .radical"
action: "it shall offer to move them into .radical/, with git mv where git knows them (the model to .radical/model, its state to .state/), point .radical/crucible/crucible.json, .mcp.json and the git hooks at the new places; setup --status shall warn about them and name the command that moves them"
ears_type: "event-driven"
trigger: "radical setup runs, with no model folder named, in a repository laid out the old way (a model in architecture/, radical.sensors.json, crucible.json or crucible/findings at the root), or one whose pull left Crucible's rounds (.crucible/rounds) or the model's state (architecture/.radical) behind"
---
