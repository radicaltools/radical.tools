---
id: "34cc1c00-bde1-45ff-88c1-f65d84d39039"
type: "scenario"
label: "NestJS, FastStream and their brokers"
given: "two NestJS apps on kafkajs, one emitting ORDER_EVENTS.CREATED from a shared constants object, the other handling it with @EventPattern, two FastStream apps on the topic .env's KAFKA_TOPIC names, and a compose Kafka beside a topics generator of the same image"
then: "orders calls shipping, pub calls sub, and all four call the broker named kafka"
when: "Assay reads and links them"
---
