---
id: "bf5b11ff-b938-49a3-8a7c-3dfd0dc1592d"
type: "scenario"
label: "Each application's configuration on a config server"
given: "a Spring Cloud Config server holding shared/application.yml with the registry's address and shared/gateway.yml with zuul routes, and services whose bootstrap.yml names them and points at the server, one with a Feign client"
then: "each service calls the registry, the gateway calls the services its routes name, the Feign client calls the service it names, and the config server calls none of them"
when: "Assay reads and links the repository"
---
