---
id: "462552ba-f87e-43a5-b0a7-f8d6869616b4"
type: "scenario"
label: "A bus by message type, kafkajs and pika"
given: "an Ordering project creating an OrderStartedIntegrationEvent, a Basket project handling IIntegrationEventHandler<OrderStartedIntegrationEvent>, a Node unit sending to the payments topic with kafkajs, and a Python unit consuming the payments queue and publishing to booked with pika"
then: "Ordering calls Basket through the event, the Node unit calls the Python unit through payments, each message on its line"
when: "Assay reads and links them"
---
