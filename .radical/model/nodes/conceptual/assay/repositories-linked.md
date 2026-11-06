---
id: "eb229f78-4634-48b0-8428-2fb09f443f60"
type: "scenario"
label: "Repositories linked"
given: "a library, a service whose OpenAPI declares /orders/{id}, and a consumer that depends on the library and calls /orders/42"
then: "the consumer depends on the library as observed and calls the service as inferred, each link citing a fact of both repositories"
when: "their facts are linked"
---
