---
id: "a26ae694-80ba-4513-9abd-113e73aca870"
type: "scenario"
label: "Path over MCP and the CLI"
given: "a folder model with a need, a requirement and two scenarios, one bound to a failing test, and its test results"
then: "both list the need, the requirement, both scenarios and both tests with their status and the failing test's message; an unknown id is refused, naming it"
when: "an agent calls get_trace with the requirement's id, and a person runs radical check --trace with it"
---
