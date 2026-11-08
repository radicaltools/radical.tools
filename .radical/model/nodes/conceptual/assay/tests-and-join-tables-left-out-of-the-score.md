---
id: "6f8ef9f8-2ad5-42c8-a4bd-6a3dbd1a5746"
type: "scenario"
label: "Tests and join tables left out of the score"
given: "an agent's model without the repository's test project, with no entity for a table that only joins two others, and with a database element resting on a compose service that runs the repository's mongodb image"
then: "neither the test project nor the join table counts as missed, each named apart, and the mongodb unit counts as built"
when: "the bench scores it"
---
