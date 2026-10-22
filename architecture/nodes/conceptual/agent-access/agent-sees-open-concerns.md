---
id: "a612a705-a1dd-47f0-bea4-0cae6db91e6d"
type: "requirement"
label: "Agent sees open concerns"
action: "list, after the metamodel issues, every unaddressed concern with the elements it applies to, where to bind it (the smallest element that settles the most first, and up to two others, each with how many it settles), its questions and the pack's id for forge_import_hub_concept"
ears_type: "event-driven"
rationale: "An agent that models a system learns which decisions it still lacks while it works, not only in CI. ADR Hub concern packs and critic."
trigger: "an agent calls get_issues"
---
