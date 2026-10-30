---
id: "ffd1830d-a205-4721-9260-d093fd377878"
type: "requirement"
label: "Check evaluates conditions"
action: "evaluate each `metrics` line of each scenario and fitness function, a metric condition against the latest measurement with its metric and labels from .radical/measurements.json and from the files and directories --metrics gives, a test() line against the test reports, and combine the results as the element's `combine` says (all by default, any, or at least N)"
ears_type: "event-driven"
rationale: "The engine and the threshold are in the model; sensors from any job feed it."
trigger: "`radical check` runs"
---
