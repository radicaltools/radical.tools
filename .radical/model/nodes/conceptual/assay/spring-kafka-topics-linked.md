---
id: "67a89bbc-4e19-4523-9140-ef4f5f00d4b0"
type: "scenario"
label: "Spring Kafka topics linked"
given: "an order unit sending on the topic order with KafkaTemplate, two units listening to it with @KafkaListener, and a listener in a comment"
then: "the order unit publishes order, the two listeners consume it, the comment names nothing, and the order unit calls each listener by a message link"
when: "Assay reads and links them"
---
