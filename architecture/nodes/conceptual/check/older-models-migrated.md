---
id: "eb3a7d02-6411-4332-a40f-80613f599e2e"
type: "requirement"
label: "Older models migrated"
action: "move each scenario's and fitness function's `tests` into `metrics` as `test(<id>) passed` lines, add a fitness function's `threshold` at the end of its description, and write the new format with the next save"
ears_type: "event-driven"
rationale: "Existing models, concern packs and Forge output keep their checks without hand edits."
trigger: "a model folder written before `metrics` is read"
---
