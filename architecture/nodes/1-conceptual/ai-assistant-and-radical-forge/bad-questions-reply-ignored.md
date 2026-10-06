---
id: "c889c91f-38d1-4861-b48f-956ebb932608"
type: "scenario"
label: "Bad questions reply ignored"
gherkin: "# Covered by: apps/studio/tests/forgeClarify.test.ts › parseClarifyResponse › returns [] for malformed JSON instead of throwing"
given: "a Forge stage is opened for the first time"
then: "no questions are shown and Generate becomes available"
when: "the clarifying-question call returns malformed JSON"
---
