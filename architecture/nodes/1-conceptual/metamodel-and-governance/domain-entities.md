---
id: "391bd89a-7595-40c9-bffa-ed6a0e49dbc4"
type: "requirement"
label: "Domain entities"
action: "The C4 + DDD preset shall offer an Entity type for domain objects (aggregate root or entity) inside a domain or group, which the C4 element owning its data realises and a state machine may model the lifecycle of."
ears_type: "ubiquitous"
rationale: "A lifecycle belongs to a domain object, not to the service that runs it, and DDD had only domains. Evidence: packages/common/src/metamodel/presets/ddd.ts (entity, realises); packages/common/src/metamodel/presets/governance.ts (lifecycle-of, implements); packages/ui/src/components/nodes/C4Nodes.tsx (EntityNode); packages/common/tests/stateMachine.test.ts"
---
