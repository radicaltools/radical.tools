---
id: "ebb6b3df-cbb4-4819-80d3-e745bf92fe03"
type: "scenario"
label: "Overdue violation fails the night"
given: "a tracked violation whose due date has passed"
then: "it fails, naming the violation and its issue"
when: "the nightly check runs"
---
