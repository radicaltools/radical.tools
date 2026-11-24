---
id: "6da94bdb-e378-48e4-a45e-3ebb1e5df427"
type: "scenario"
label: "Red main counted"
given: "the commits pushed to main in the last 30 days, some with a failed run"
then: "the share of commits whose runs all succeeded is at least 90 %, and the check fails below it"
when: "the nightly measurement runs"
---
