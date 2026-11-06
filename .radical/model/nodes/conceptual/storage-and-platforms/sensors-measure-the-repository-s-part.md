---
id: "047fda95-597e-4bcc-8b3c-8d285f3a47c5"
type: "requirement"
label: "Sensors measure the repository's part"
action: "it shall run a fitness function only for the elements the repository builds, and skip a fitness function with none of them"
ears_type: "event-driven"
rationale: "A sensor looks in the repository's code, which does not hold another repository's elements."
trigger: "radical sense run runs on a model that the repository's .radical/radical.json names"
---
