---
id: "b7985f11-aac1-4ebc-a714-c5feb3f4b97c"
type: "scenario"
label: "A queue between its sides"
given: "a producer that sends to a queue a consumer reads, the queue off to the side"
metrics: "test(packages/layout/tests/tidy/conventions.test.ts › a queue between producer and consumer) passed"
then: "the queue stands between the producer and the consumer, on the line between them"
when: "Smart Layout tidies it"
---
