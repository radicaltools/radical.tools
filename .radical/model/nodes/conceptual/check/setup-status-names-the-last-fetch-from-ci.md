---
id: "e61e1909-8819-4213-aa6f-5780c2eb0607"
type: "requirement"
label: "Setup status names the last fetch from CI"
action: "the CLI shall print when the last fetch from CI ran and what it found, as a warning when it found no results or could not fetch, with what CI has to keep as artifacts"
ears_type: "event-driven"
rationale: "A person who wonders why Studio shows old results asks the status command; isostride asked for a warning in Studio or in some status command. Evidence: apps/cli/src/setupStatus.ts"
trigger: "radical setup --status runs in a repository whose model folder has a record of a fetch from CI"
---
