---
id: "c533f4b8-2cd3-45cb-aff1-a0659d7a406f"
type: "requirement"
label: "Concern packs"
action: "hold only concern packs in the Hub catalogue, at least for authentication, authorization, personal data, backup and recovery, integration resilience, messaging, observability, secrets, API evolution and rate limiting, each with its concern id, a trigger (a query in the model query language, with the end of the relation it applies to, whose result elements are the ones the concern applies to), the questions that decide the concern as template parameters with options, and a connected slice: a need, the requirements derived from it, an ADR marked with the concern, the fitness functions that implement it and the scenarios that verify the requirements, each element imported only for the answers it names"
ears_type: "ubiquitous"
rationale: "A single concept breaks the model's check rules once imported and says nothing about when it applies; a pack brings its links and its trigger. The single concepts and blueprints the Hub held before are gone. ADR Hub concern packs and critic."
---
