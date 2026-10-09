---
id: "391bd89a-7595-40c9-bffa-ed6a0e49dbc4"
type: "requirement"
label: "Domain entities"
action: "The C4 + DDD preset shall offer an Entity type for domain objects (aggregate root or entity) inside a domain or group, a Part of relation from a part to its aggregate root and a References relation between aggregates (cardinality one or many), and warn about an entity outside any aggregate, a part of two aggregates or of a non-root, and an aggregate root inside another."
ears_type: "ubiquitous"
rationale: "A lifecycle belongs to a domain object, not to the service that runs it, and a domain model needs aggregates and the references between them. Evidence: packages/common/src/metamodel/presets/ddd.ts (entity, part-of, references, realises); packages/common/src/metamodel/domainModel.ts; packages/common/tests/domainModel.test.ts; packages/common/tests/stateMachine.test.ts"
---
