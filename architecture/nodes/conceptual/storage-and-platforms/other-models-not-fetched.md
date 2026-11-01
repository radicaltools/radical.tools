---
id: "b5aad47b-a4bb-417c-bfc1-7e6f7fdacb73"
type: "requirement"
label: "Other models not fetched"
action: "Studio shall say that the model depends on other models not fetched yet, and name the command that fetches them"
ears_type: "state-driven"
precondition: "the open model folder has a deps.json and no .radical/federation.json"
rationale: "Studio cannot fetch from git in the browser; without the note a relation to another model's element would just point at nothing."
---
