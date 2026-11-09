---
id: "f68ed0f7-d8b2-4263-a6fd-9004e6dac43d"
type: "scenario"
label: "A Go program's dependencies and its Dockerfile"
given: "a Go module whose commandsd reaches a package importing amqp091-go and whose queriesd imports pgx, a Dockerfile under build/ running go build ./cmd/commandsd/..., an SQL file under build/postgres and a compose RabbitMQ"
then: "commandsd depends on amqp091-go only and queriesd on pgx only, the compose service runs commandsd, the table events is read, and commandsd calls rabbitmq"
when: "Assay reads it"
---
