---
id: "1f73bca6-cd15-4325-9396-a7e0bf6188db"
type: "requirement"
label: "Setup status shows the other models"
action: "the CLI shall list each dependency with the version deps.json pins and the commit fetched, and warn when nothing is fetched or deps.json pins a version other than the one fetched"
ears_type: "event-driven"
rationale: "An agent working without the other models relates to elements it does not see. Evidence: apps/cli/src/status.ts"
trigger: "radical setup --status runs on a model folder with a deps.json"
---
