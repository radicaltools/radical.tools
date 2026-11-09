---
id: "5bae57b7-ffe0-42b3-98ce-f96dfb62a3ef"
type: "requirement"
label: "Read Spring Cloud configuration"
action: "the system shall read each such file as configuration of the unit whose spring.application.name it is named for, and application.yml as configuration of every unit taking its configuration from the server; a gateway's routes (url, serviceId) and a Feign client's name are addresses of the unit that holds them; a setting a client library reads (spring.rabbitmq, spring.data.mongodb, spring.redis, spring.kafka, spring.datasource, eureka.client, security.oauth2) counts for a unit only when the unit depends on that library; an app depending on a client of Eureka, of a config server, of Kafka or of RabbitMQ connects, as Spring Cloud does by default, to the one server of that kind its repository has (a unit depending on its server, or a deployed service of its image), an inferred link citing the dependency; a config server serving its clients' configuration from another repository (spring.cloud.config.server.git.uri) is noted, naming that repository"
ears_type: "event-driven"
rationale: "Measured on piggymetrics: the registry, broker and database addresses of six services sat in the config server's folder and were read as calls of the config server."
trigger: "a unit is a Spring Cloud Config server whose own resources hold the configuration of other applications (shared/<application>.yml, application.yml)"
---
