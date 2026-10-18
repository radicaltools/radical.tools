---
id: "e1db81db-0a60-4437-a539-7ff83974b99b"
type: "requirement"
label: "Forge asks for a view structure"
action: "Radical Forge shall offer two view structures, Radical (the default when the metamodel has viewpoints: a view of each of its viewpoints, in the folders Conceptual, Logical and Governance as in radical.tools' own model, any of which the user can leave out) and Layer canvases (Conceptual, Domain, States, Processes, Logical & physical, Governance), preselect the one the model already has, and file the run's output into the one chosen."
ears_type: "event-driven"
rationale: "The views a run makes are the structure of the model the user goes on to work in; they decide it before the first element is written. radical.tools' own model is the reference structure. Evidence: packages/common/src/ai/forge/views.ts (ForgeStructure, RADICAL_FOLDERS, radicalViewpoints, defaultForgeStructure); apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (Description step, Views); apps/mcp/src/forge.ts (forge_start views, structureArg)"
trigger: "a user is about to start a Radical Forge run (the Description step in Studio, forge_start over MCP)"
---
