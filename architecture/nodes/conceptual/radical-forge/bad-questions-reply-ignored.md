---
id: "c889c91f-38d1-4861-b48f-956ebb932608"
type: "scenario"
label: "Bad questions reply ignored"
given: "a Forge stage is opened for the first time"
metrics: "test(packages/common/tests/forgeClarify.test.ts › parseClarifyResponse › returns [] for malformed JSON instead of throwing) passed"
then: "no questions are shown and Generate becomes available"
when: "the clarifying-question call returns malformed JSON"
---
