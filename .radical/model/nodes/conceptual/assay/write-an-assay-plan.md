---
id: "04572b1c-10ad-4e98-80d6-d8bed5c714bf"
type: "requirement"
label: "Write an Assay plan"
action: "the system shall write the plan's observed and inferred elements and relations into the central model, keep each one's evidence and confidence in the central repository's .radical/assay/run.json and none of them in the model, and return each hypothesis as a proposal for the user"
ears_type: "event-driven"
rationale: "The model holds nothing of the repository (ADR The model folder holds nothing of the repository); the evidence stays beside it."
trigger: "an agent calls assay_apply with a plan the server accepts"
---
