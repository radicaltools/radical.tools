---
id: "3c9f05fa-2e1f-41ed-b17d-caa48b8fd52f"
type: "requirement"
label: "Setup asks for the other models"
action: "the CLI shall ask, after the model folder, for the models this one depends on, each with its name, repository, model folder and version, offering the repository's newest version tag or else its default branch, keep the dependencies deps.json names already, write deps.json, and fetch them"
ears_type: "event-driven"
rationale: "Writing deps.json by hand means knowing its format and looking up the versions a repository has; setup is where a team connects a model. Evidence: apps/cli/src/setup.ts (step 3, Other models), apps/cli/src/federation.ts (latestRef, fetchFederation)"
trigger: "radical setup runs in a terminal"
---
