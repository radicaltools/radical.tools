---
id: "28b96e68-030b-4d30-b525-97dde7811a57"
type: "scenario"
label: "Calls to deployed services scored"
given: "an agent's model whose container relates to a queue element resting on the service fact rabbitmq, and to a database element resting on a service that runs the mongodb unit"
then: "the relations count as calls to service:rabbitmq and to mongodb"
when: "the bench scores it"
---
