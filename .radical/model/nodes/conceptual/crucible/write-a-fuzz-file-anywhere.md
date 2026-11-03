---
id: "3be3c4db-ccd3-44af-9646-a37a102a5533"
type: "requirement"
label: "Write a fuzz file anywhere"
action: "the package shall let it write a fuzz file that radical fuzz runs: worlds, actions and rules, a test case per world and per rule of each world, known failures, the survey, the replay of a finding and the shrinking of a failure."
ears_type: "event-driven"
rationale: "radical fuzz runs fuzz files, and without the engine each project would have to rebuild what those options read."
trigger: "a project outside this repository installs @radicaltools/crucible"
---
