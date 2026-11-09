---
id: "73a6b004-243e-4cba-83a7-d9fe687f0101"
type: "requirement"
label: "Link facts across repositories"
action: "the system shall relate a unit that depends on a package another unit is to that unit as observed, and a unit whose code names a path an OpenAPI description of another unit declares to that unit as inferred, each link citing the facts on both sides; a name (a host, a compose service a unit depends on) names a unit or service of the caller's own repository before one of another, and depends_on only one of its own; an app depending on a broker's client library of any stack (Kafka: kafkajs, kafka-python, aiokafka, confluent-kafka, FastStream, kafka-go, sarama, Confluent.Kafka; RabbitMQ: amqplib, pika, aio-pika, amqp091-go, Watermill's AMQP, RabbitMQ.Client, MassTransit.RabbitMQ; NATS: nats, nats-py, nats.go) connects to the one broker of that kind its repository deploys (the one named for its kind where several are, kafka beside its topics' generator), or, where it deploys none, to the broker the library connects to by default, an assumed service resting on the client's dependency"
ears_type: "event-driven"
rationale: "Relations across repositories are what a model of several repositories is for, and no single repository states them."
trigger: "the facts of a run's repositories are read"
---
