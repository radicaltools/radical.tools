---
id: "be8421be-b7e2-4d22-87b2-2ce31737d1eb"
type: "scenario"
label: "gRPC call linked"
given: "a proto declaring a service, a Go unit registering its server and a Python unit making its client"
then: "the Python unit calls the Go unit, inferred, citing the proto, the registration and the client"
when: "their facts are linked"
---
