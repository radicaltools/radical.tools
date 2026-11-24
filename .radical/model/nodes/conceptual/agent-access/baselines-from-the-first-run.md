---
id: "b471b5b9-bdc2-450c-a6e7-baf31062c6c2"
type: "requirement"
label: "Baselines from the first run"
action: "it shall write a check.json that sets every rule to error and waits for its baselines, which radical check --adopt takes once from the counts and percentages of its first run, and which --ratchet only lowers from then on"
ears_type: "event-driven"
rationale: "Existing code has gaps the new model finds on its first day; the gate holds them where they are and lets them only shrink. ADR Strict gate for new models."
trigger: "radical setup starts a new model in a repository with code, or an Assay run finishes in a folder without check.json"
---
