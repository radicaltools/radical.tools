---
id: "d7431a7a-278a-4f88-b8e2-c117aa43b6d3"
type: "scenario"
label: "A consumer contract test is judged here"
given: "payments binds a test to a scenario of orders, pinned in deps.json, and its test report says the test failed"
then: "the failed test is an error of payments' check, naming orders' scenario, and the path reaches that scenario and the test"
when: "radical check runs on payments' model with the report, then with --trace on that scenario"
---
