---
id: "09e025c3-1b24-46e3-afeb-0bcda2ba344e"
type: "requirement"
label: "Dependencies come transitively"
action: "the CLI shall compose the models it names too, level by level, compose a model pinned twice at the nearest pin (the model's own deps.json first, then its dependencies' in the order they name them), name each pin it left out, and leave out a pin back to the model itself"
ears_type: "event-driven"
rationale: "A dependency's relations to the models it depends on are part of its model; left out, they and the model's own relations to those models would point at nothing. The nearest pin is the one the model's owners can change, as in Maven. A repository given as a path can be resolved only for a dependency on disk. Evidence: apps/cli/src/federation.ts (fetchAll), packages/node-files/src/gitDeps.ts (fetchDependency returns its deps.json and its folder on disk)"
trigger: "a dependency's model names dependencies of its own in its deps.json"
---
