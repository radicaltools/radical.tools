---
id: "54fbd45f-199b-41c2-8670-cfd0d756eb97"
type: "requirement"
label: "Forge proposes baseline packs"
action: "it shall propose, checked, the concern packs every system needs (CI/CD pipeline, Test strategy, Release and versioning, Code quality gate) and, with an interface for people, Usability, Accessibility and Mobile and perceived performance, beside those the description calls for, each of which the user can uncheck before its questions are asked"
ears_type: "event-driven"
rationale: "A description of a product rarely speaks of its pipeline, its tests or its accessibility, so a model that picks only what the description names leaves out the practices every system needs. ADR Forge settles concerns, C4 binds them."
trigger: "the Requirements stage of a Forge run asks its questions"
---
