---
id: "21b44fdc-839f-4c94-913d-1945228aaed4"
type: "requirement"
label: "Map the code repositories"
action: "the system shall write into that repository's .radical/radical.json the implements of those elements with the units' paths or the folders the plan names for them, the verifies binding each scenario to its tests, and a model entry naming the central model's repository by its address, its origin or else its path from the repository (ADR One system model across repositories)"
ears_type: "event-driven"
rationale: "Each code repository says which elements of the central model it builds and which tests check them (the central shape of ADR Radical Assay)."
trigger: "Assay writes elements built from a repository's units, or scenarios its tests check"
---
