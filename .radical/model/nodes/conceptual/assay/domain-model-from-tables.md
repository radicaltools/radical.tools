---
id: "c9d4efcf-85b2-4d8d-b7b9-52c2aae14dc1"
type: "requirement"
label: "Domain model from tables"
action: "the MCP server shall write each entity as observed into the domain the plan names, citing its table facts, relate it part-of or references another entity only where a foreign key of its tables references the other's, relate each element of the run built from a unit whose code names its table to it (realises), and refuse the plan when an entity cites no table fact or a relation between entities no foreign key"
ears_type: "event-driven"
rationale: "Entities found in the tables are facts, not guesses; a relation between them is evidence only where the schema states it."
trigger: "an agent applies a plan with entities during an Assay run"
---
