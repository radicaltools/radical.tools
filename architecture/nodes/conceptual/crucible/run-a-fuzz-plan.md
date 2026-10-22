---
id: "e4c1bbcb-b278-48b8-9a1f-68a1b7085e10"
type: "requirement"
label: "Run a fuzz plan"
action: "the CLI shall run each fuzz file through the project's test runner with the plan's settings (ci: the seeds and runs each file fixes; night: a random seed and 2000 runs of each world, or the runs given), passing --world, --seed, --runs and --length on, show the runner's output, and exit with 0 when every file passed, 1 when one failed and 2 when it could not run"
ears_type: "event-driven"
rationale: "One command runs every fuzz file the way CI and a night run need it, instead of environment variables typed per file."
trigger: "the user runs radical fuzz [plan] in a project whose crucible.json lists fuzz files"
---
