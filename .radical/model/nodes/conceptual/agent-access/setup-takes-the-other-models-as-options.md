---
id: "b972cf3c-674f-43d5-ad5b-dc6de2ddf7bf"
type: "requirement"
label: "Setup takes the other models as options"
action: "the CLI shall add each dependency it names (<name>=<repository>[#<version>[:<model folder>]]) to deps.json without asking, with the version and model folder defaulting as in a terminal, and fetch them"
ears_type: "event-driven"
rationale: "CI and scripts set a model up without a terminal. Evidence: apps/cli/src/setup.ts (parseDependsOn)"
trigger: "radical setup runs with --depends-on"
---
