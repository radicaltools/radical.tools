---
id: "7b518aa0-7c33-439e-98de-fecacdf62bda"
type: "scenario"
label: "Reruns counted"
given: "the completed runs of the last 30 days"
then: "at most 5 % of them have a run attempt above 1, and the check fails above it"
when: "the nightly measurement runs"
---
