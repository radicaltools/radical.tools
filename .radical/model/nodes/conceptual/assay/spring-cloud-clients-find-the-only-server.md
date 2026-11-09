---
id: "09aed2c5-4920-4413-83a7-748112c965b2"
type: "scenario"
label: "Spring Cloud clients find the only server"
given: "a repository with one Eureka server, one config server that registers with it, an app depending on the Eureka client, the config client and spring-kafka beside a compose Kafka, a library depending on spring-kafka, and another repository with two Eureka servers"
then: "the config server and the app register with the Eureka server, the app reads the config server and talks to Kafka, the library connects to nothing, and with two Eureka servers no client is linked to either"
when: "Assay links them"
---
