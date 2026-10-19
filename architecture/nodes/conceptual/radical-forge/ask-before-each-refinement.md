---
id: "22418a18-7acd-45b7-a7de-790d90cda253"
type: "requirement"
label: "Ask before each refinement"
action: "Radical Forge shall pause the stage, show the user what it found and exactly what it would add or change (each element with its type, label and fields, each link with its ends, each change with its old and new values), and apply it, all of it, only if the user accepts; the user's reply, if any, shall go back to the stage with the answer, and Regenerate shall take back the refinements accepted in the stage's previous attempt as well as its additions"
ears_type: "event-driven"
rationale: "The user decides while the stage still has the finding in hand, on exactly what will be written, rather than on a list of labels after the stage has built on it. Evidence: packages/common/src/ai/forge/proposals.ts (describeProposal, applyProposal); apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (the proposal card); apps/studio/src/renderer/src/ai/runner.ts (extraTools); apps/mcp/src/forge.ts (forge_propose_refinement, forge_answer_refinement)"
trigger: "a Forge stage finds that an earlier stage should get an element, a link or a correction"
---
