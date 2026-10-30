---
id: "3e5d9941-57b7-4e51-8f05-2562504826dc"
type: "requirement"
label: "Stale measurement not passed"
action: "report the condition stale, with the measurement's age, and never count it as passed"
ears_type: "unwanted-behaviour"
rationale: "A result from last week's load test or a closed production window must not pass today's change."
unwanted_condition: "the latest measurement a condition matches is older than the element's max_age"
---
