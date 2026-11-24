---
id: "d69665b4-33bc-46e0-8edf-a41126bd4d10"
type: "requirement"
label: "Baselines not taken yet"
action: "radical check and the Inspector shall report an error that says to run radical check --adopt and commit check.json"
ears_type: "unwanted-behaviour"
rationale: "A gate that waits for its first baselines must not pass silently, nor fail on findings the code had before the model. ADR Strict gate for new models."
unwanted_condition: "check.json waits for the baselines of its first run"
---
