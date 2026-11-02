---
id: "0df91f39-96fa-45b0-8a41-4f1a859e4212"
type: "requirement"
label: "Forge models processes"
action: "Radical Forge shall model each procedure the requirements and scenarios describe (none when they describe none) as a process of ordered steps, with each step's repetition and condition and, where the scenarios branch or run side by side, the alternatives (choice) or the parts at once (concurrent), link the scenarios that walk it to it with verifies and it to its requirements with satisfies, and file the processes into a Processes view of the viewpoint Process (Warnier); the C4 stage shall then link each step to the element that performs it with performed-by"
ears_type: "event-driven"
rationale: "The scenarios are examples of a procedure's paths; the process is the procedure, which the screens and the C4 decomposition can follow. A Warnier view needs no layout, so the stage offers nothing to arrange. Evidence: packages/common/src/ai/forge/prompts.ts ('processes', the C4 stage's performed-by), packages/common/src/ai/forge/views.ts (the Processes view), apps/studio/src/renderer/src/components/RadicalForgeModal.tsx, apps/mcp/src/forge.ts"
trigger: "the user generates the Processes stage, after the state machines and before the mockups"
---
