---
id: "62b6849d-5aff-4d06-b0cd-776b410b6a6b"
type: "requirement"
label: "Check judges the repository's part"
action: "it shall report findings and measure goals only for the repository's part: the elements it builds, the requirements they satisfy and what those derive from, the state machines they implement or that are the lifecycle of the entities they realise, with everything in those machines, those entities, the scenarios of those requirements and state machines, the ADRs that constrain those elements and the fitness functions of those ADRs"
ears_type: "event-driven"
rationale: "A repository cannot fix what another builds, and its gate must not depend on it."
trigger: "radical check runs on a model that the repository's .radical/radical.json names"
---
