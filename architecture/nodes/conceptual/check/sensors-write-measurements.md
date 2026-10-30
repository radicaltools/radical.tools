---
id: "3a97f0ea-d4e5-4be9-ba54-5192c7c178c8"
type: "requirement"
label: "Sensors write measurements"
action: "run that adapter and append the values it reads to a radical-metrics/1 file in the model folder's .radical/measurements.json, keeping the latest of each metric and labels (or to the radical-metrics/1 file --out names), with their units, the labels given, the source, the time and the context, without judging them"
ears_type: "event-driven"
rationale: "The sensor only measures, so a tool can be swapped without touching the model, and the threshold stays in the model."
trigger: "`radical sense <adapter>` runs on a tool's output"
---
