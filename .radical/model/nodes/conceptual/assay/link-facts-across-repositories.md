---
id: "73a6b004-243e-4cba-83a7-d9fe687f0101"
type: "requirement"
label: "Link facts across repositories"
action: "the system shall relate a unit that depends on a package another unit is to that unit as observed, and a unit whose code names a path an OpenAPI description of another unit declares to that unit as inferred, each link citing the facts on both sides"
ears_type: "event-driven"
rationale: "Relations across repositories are what a model of several repositories is for, and no single repository states them."
trigger: "the facts of a run's repositories are read"
---
