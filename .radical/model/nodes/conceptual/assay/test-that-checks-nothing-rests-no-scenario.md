---
id: "6ceb323d-625f-492c-965a-b6db3b5f5c77"
type: "requirement"
label: "Test that checks nothing rests no scenario"
action: "the system shall refuse the plan, saying the test checks nothing, and record that on the test fact"
ears_type: "event-driven"
rationale: "A test that passes without checking anything is no evidence."
trigger: "a scenario cites a test whose body is empty or asserts nothing"
---
