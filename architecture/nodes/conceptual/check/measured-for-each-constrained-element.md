---
id: "23ffaa2e-1e6d-4cdf-b7c7-1aa294787bf7"
type: "requirement"
label: "Measured for each constrained element"
action: "the CLI shall run each of its measure lines whose sensor the repository's radical.sensors.json names once per such element, passing --context with the fitness function, the ADR and the element as JSON, and label each measurement with the element"
ears_type: "event-driven"
trigger: "radical sense run runs a fitness function that implements an ADR constraining elements of the model directly, the fitness function the model's own or fetched from another model"
---
