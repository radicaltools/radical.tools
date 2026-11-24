---
id: "a9b5a4d8-13af-4b9c-8bf8-98f827fa01d5"
type: "scenario"
label: "Slow pipeline found"
given: "the pull-request commits of the last 30 days"
then: "the 90th percentile of their pipeline time is at most 15 minutes, and the check fails on the night it is not"
when: "the nightly measurement runs"
---
