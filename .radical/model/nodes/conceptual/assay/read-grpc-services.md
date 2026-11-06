---
id: "49103558-00bb-4898-90bd-aaf0bc34ecbc"
type: "requirement"
label: "Read gRPC services"
action: "the system shall take each service as an API of the unit that registers or implements it, and link a unit whose code makes a client of that service to that unit as inferred, leaving generated code out"
ears_type: "event-driven"
rationale: "Services that talk gRPC state their contracts in .proto files, not in OpenAPI."
trigger: "a repository holds .proto files that declare services"
---
