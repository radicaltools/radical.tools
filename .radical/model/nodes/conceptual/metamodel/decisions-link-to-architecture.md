---
id: "c0a91378-1742-435c-ba03-6ade61c096da"
type: "requirement"
label: "Decisions link to architecture"
action: "The governance preset shall allow ADRs, fitness functions and requirements to constrain persons, systems, domains, containers, components, databases, web apps and queues, an ADR to supersede an ADR, and a fitness function to implement an ADR."
ears_type: "ubiquitous"
rationale: "Decisions and checks are tied to the elements they govern and to each other. Evidence: packages/common/src/metamodel/presets/governance.ts:231-264; apps/e2e/tests/studio/metamodel-diagram.spec.ts:56-62; manual#properties; manual#relations"
---
