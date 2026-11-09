---
id: "24085eb1-d88b-44c7-8693-874aeff86d66"
type: "scenario"
label: "A JVM unit as it is"
given: "a Gradle library applying only java and maven-publish while depending on Spring Boot's web starter, its tests importing org.junit.Test, and a config server applying spring-boot whose settings set server.port 8888, spring.rabbitmq.port 5672 and a registry address with a password, beside an in-memory database in src/test/resources"
then: "the library is a library tested with JUnit 4, the config server an app listening on 8888 only, no database is read from the test settings, and the address keeps its password as ***"
when: "Assay reads them"
---
