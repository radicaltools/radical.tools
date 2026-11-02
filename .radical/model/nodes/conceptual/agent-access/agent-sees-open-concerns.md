---
id: "a612a705-a1dd-47f0-bea4-0cae6db91e6d"
type: "requirement"
label: "Agent sees open concerns"
action: "list, after the metamodel issues, every unaddressed concern with the elements it applies to, where to bind it (the smallest element that settles the most first, and up to two others, each with how many it settles), its questions and the pack's id for forge_import_hub_concept, and each accepted ADR marked with a concern that constrains no element, with where to bind it and its fitness functions, as radical check's concern-unbound does; a concern whose pack is already imported unbound says to bind it, not to import it again"
ears_type: "event-driven"
rationale: "An agent that models a system learns which decisions it still lacks while it works, not only in CI. ADR Hub concern packs and critic. After an import without binding it told the agent to import the pack again, which made a duplicate (round 170–175, 2026-10-22, F-0005). Evidence: apps/mcp/src/folderModel.ts (openConcerns), packages/common/src/concerns.ts (unboundDecisions), packages/common/src/check/rules.ts"
trigger: "an agent calls get_issues"
---
