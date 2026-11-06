---
id: "ef4bb0bf-918b-4043-852f-453f99a0e4fc"
type: "requirement"
label: "A model checked out in a repository"
action: "the CLI shall read and write that .radical/radical.json as the repository's mapping, and read the model's history from the model's own git"
ears_type: "event-driven"
rationale: "Looking for the file stops at the nearest .git, which would be the checkout's."
trigger: "a model folder at .radical/model is a git repository of its own, inside a repository with a .radical/radical.json"
---
