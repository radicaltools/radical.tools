---
id: "640e1d91-fdf4-458b-9013-3571820a00a7"
type: "requirement"
label: "One command runs the checks locally"
action: "let a developer run every check of the pull-request workflows on their own machine with one command, npm run verify, by making every pull-request step a package.json script that verify runs"
ears_type: "ubiquitous"
rationale: "Checks run before the push fail in seconds and in private, and the same commands in CI keep the two from drifting apart (Fowler, Continuous Integration: automate the build, one command to build and test)."
---
