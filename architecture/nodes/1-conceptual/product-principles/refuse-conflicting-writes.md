---
id: "7622ecf5-5747-498f-b04f-91564c72028a"
type: "requirement"
label: "Refuse conflicting writes"
action: "The system shall refuse the write and keep the outside change."
ears_type: "unwanted-behaviour"
rationale: "Model files are edited in other editors, by git and by coding agents."
unwanted_condition: "a model file changed outside the app since the app read it"
---
