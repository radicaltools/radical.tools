---
id: "104f65bb-e5d8-4721-9630-f6a97234437f"
type: "requirement"
label: "Fetch the versions milestones keep"
action: "the CLI shall fetch those versions too and write them into .radical/federation.json beside the current ones, and name a milestone's version of a model the deps.json no longer names"
ears_type: "event-driven"
rationale: "Studio cannot fetch from git; the versions a milestone shows have to be fetched beforehand, as the current ones are. Evidence: apps/cli/src/federation.ts (fetchFederation)"
trigger: "radical federation fetch runs on a model whose milestones keep versions of other models"
---
