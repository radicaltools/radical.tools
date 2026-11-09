---
id: "a31c9426-cb89-4568-9fc2-6c1314620ab6"
type: "scenario"
label: "NATS subjects and an assumed broker"
given: "three Go programs connecting to nats.DefaultURL, one publishing a subject named by a constant in another file of its package, one queue-subscribing to it, one subscribing to ORDERS.*, beside a program named nats-cli"
then: "an assumed nats service rests on the client dependency, each program calls it, and the publisher calls the queue subscriber and the wildcard subscriber"
when: "Assay reads and links them"
---
