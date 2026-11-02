---
id: "46a8b0e8-c61d-4a02-a37d-d62d8302212f"
type: "scenario"
label: "Finding replayed as test"
given: "a fuzz suite with a known failure, and findings of it: one hardened, one fixed, one open, one of another file"
then: "there is a case for the hardened and the fixed finding only, named \"<id> stays fixed: <title>\", and the hardened one fails on the bug although the known list covers it"
when: "the suite's cases are listed and the hardened finding's case runs"
---
