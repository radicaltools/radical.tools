---
id: "f8171672-749f-4383-a299-5e8788564bb5"
type: "requirement"
label: "Offer to arrange each stage"
action: "Radical Forge shall ask whether to keep the stage's new elements in a row, a column or a grid on their view, and whether to run Smart Layout on that view, and shall arrange nothing the user did not choose."
ears_type: "event-driven"
rationale: "The user decides how a stage's output is laid out before the next stage adds to it. Evidence: RadicalForgeModal.tsx (Arrange panel: arrangeStage, layoutStage); apps/mcp/src/forge.ts (forge_arrange)"
trigger: "a Forge stage completes"
---
