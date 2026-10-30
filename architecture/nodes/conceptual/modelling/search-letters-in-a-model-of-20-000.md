---
id: "381d78fb-87b0-4428-8034-2e2323500c59"
type: "scenario"
label: "Search letters in a model of 20,000"
given: "a model of 20,000 elements shaped like radical.tools' own, its descriptions with dashes and arrows"
metrics: "test(packages/common/tests/largeModels.test.ts › a model of 20,000 elements › folds each text of the model once, and no text again for the letters typed after) passed"
then: "the first letter folds every text of the model, the queries after fold none again, and the last finds more than 1,000 elements; how long a letter takes in Studio is measured at night (fitness function Large model stays responsive)"
when: "one letter is searched, then five longer queries as the letters are typed"
---
