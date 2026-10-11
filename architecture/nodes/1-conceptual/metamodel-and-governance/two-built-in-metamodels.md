---
id: "b6bbd06e-4323-4131-9a3c-2018253fb841"
type: "requirement"
label: "Two built-in metamodels"
action: "The system shall offer two built-in metamodels: the Radical metamodel, the default, and C4; the Radical metamodel extends C4 with DDD domains and entities and with what shapes the architecture (needs, requirements, ADRs, fitness functions, scenarios, mockups and state machines)."
ears_type: "ubiquitous"
rationale: "Teams can model right away with a known notation instead of designing types first, and two choices are easier to pick between than three nested ones. Evidence: packages/common/src/metamodel/presets/index.ts (availableMetamodels); packages/common/src/metamodel/presets/governance.ts (RADICAL_METAMODEL_NAME); packages/ui/tests/model.test.ts › built-in metamodels; manual#metamodel"
---
