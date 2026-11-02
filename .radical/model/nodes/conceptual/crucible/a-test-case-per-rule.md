---
id: "09413031-8f6d-4198-b827-3f479a87dd3a"
type: "requirement"
label: "A test case per rule"
action: "the system shall report one test case per world, and one per world and rule that fails when a run of that world broke the rule outside the known failures, so that scenarios and fitness functions name a rule of a world as a test"
ears_type: "event-driven"
rationale: "radical check binds tests by name; a rule of its own is evidence a requirement or an ADR can point at."
trigger: "a fuzz file runs under the test runner"
---
