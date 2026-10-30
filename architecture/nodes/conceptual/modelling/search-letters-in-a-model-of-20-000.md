---
id: "381d78fb-87b0-4428-8034-2e2323500c59"
type: "scenario"
label: "Search letters in a model of 20,000"
given: "a model of 20,000 elements shaped like radical.tools' own, its descriptions with dashes and arrows, searched once already"
metrics: "test(packages/common/tests/largeModels.test.ts › a model of 20,000 elements › finds the matches of each letter typed in Quick Search within 250 ms) passed"
then: "the fastest of the three takes under 250 ms on CI's machines (under 100 ms on a developer's) and finds more than 1,000 elements"
when: "the words \"layout sta\" are searched, three times"
---
