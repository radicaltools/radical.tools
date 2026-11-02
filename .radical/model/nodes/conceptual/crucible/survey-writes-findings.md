---
id: "e40052a3-2bde-4650-b046-4c86941bc7cc"
type: "scenario"
label: "Survey writes findings"
given: "a fuzz file with two rules broken in three ways, one of them already an open finding"
then: "the first run writes one open finding per new signature, with its rule, world, seed, path, steps and what differs, and the second writes none"
when: "radical fuzz --survey runs, and runs again"
---
