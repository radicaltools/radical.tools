---
id: "6d8080a1-5be9-4123-b2e7-42edbb2370da"
type: "scenario"
label: "Shared settings of libraries a client lacks"
given: "a config server's shared application.yml giving the broker's, the registry's and the auth server's addresses, a service depending on the AMQP bus, Eureka and OAuth2, and a gateway depending on Eureka only"
then: "the service calls the broker, the registry and the auth server, and the gateway only the registry"
when: "Assay reads and links the repository"
---
