---
id: "55aaeeca-7d93-4c88-b8f0-5050aca3d91a"
type: "requirement"
label: "Gate runs on the server"
action: "run its pull-request checks on the CI platform's runners for every pull request, and refuse the merge until the gate job ci, which needs every other job of the pull-request workflow, has succeeded, counting a skipped or cancelled job as a failure"
ears_type: "ubiquitous"
rationale: "A green run on a developer's machine is evidence nobody else can see; a required check on the server is the gate nobody can skip, and GitHub reports a skipped job as a success unless a gate counts it (Fowler, Continuous Integration; GitHub Docs: Using conditions to control job execution)."
---
