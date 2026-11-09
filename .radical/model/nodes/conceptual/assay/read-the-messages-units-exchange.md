---
id: "c4d5b3eb-dbb0-4f76-b78c-ef8b357157ad"
type: "requirement"
label: "Read the messages units exchange"
action: "the system shall record each as a message fact of that unit with its role, its channel and what carries it, with its file and line: Spring Kafka's @KafkaListener and KafkaTemplate.send, Spring AMQP's @RabbitListener and RabbitTemplate.convertAndSend, Spring Cloud Stream's @StreamListener, StreamBridge.send and source.output() with the destinations its configuration's bindings give them (a binding only configured counts by its name: input and -in-N consume, output and -out-N publish), read from the syntax tree, a comment naming none; kafkajs, amqplib, pika, kafka-python, Confluent.Kafka, kafka-go and sarama by their calls; a .NET bus's handlers of a message type (IConsumer<T> only where the file uses MassTransit, an application's own in-process events being none; IIntegrationEventHandler<T>, IHandleMessages<T>) and the units creating a message of a type some unit handles; and shall link each unit publishing on a channel to each unit consuming it, those of its own repository first, as an inferred message link"
ears_type: "event-driven"
rationale: "Units that talk through a broker name each other nowhere: each names only the broker, so a model read from addresses shows every service calling the queue and none calling another. eShop's Ordering.API starts Basket.API, Catalog.API, PaymentProcessor and the web application through integration events only."
trigger: "a unit's code publishes or consumes messages on a topic, a queue or an exchange, or of a message type a bus routes by its type"
---
