---
id: "9a804e04-1239-4d62-b930-b6b1ca8f8c67"
type: "requirement"
label: "Studio follows a fetch"
action: "Studio shall show the other models as fetched now, keeping the edits not saved yet"
ears_type: "event-driven"
rationale: "Two copies are safe only while something keeps them in step; a folder is acted on once it has been still for one interval, as an editor writes a model in several files. Evidence: apps/cli/src/federation.ts (watch)"
trigger: ".radical/federation.json changes while Studio has the model open"
---
