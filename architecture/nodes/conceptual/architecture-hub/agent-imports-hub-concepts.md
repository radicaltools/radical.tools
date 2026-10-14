---
id: "95e6ea21-9c69-4270-9e5f-85f775018c17"
type: "requirement"
label: "Agent imports Hub concepts"
action: "add the concept as it is, with fresh ids, its relations, sequences and named views and its template parameters at their defaults, to the right of the model's top-level elements, and refuse an id the bundled catalogue does not have"
ears_type: "event-driven"
rationale: "What Forge's Import button does in Studio, for an agent: a fitting blueprint or pattern comes in whole as a skeleton. Evidence: apps/mcp/src/forge.ts (forge_import_hub_concept, importConcept), packages/common/src/hubImport.ts (buildConceptInsert, defaultParamValues), apps/mcp/tsup.config.ts (bundled catalogue)"
trigger: "an agent calls forge_import_hub_concept with a concept id"
---
