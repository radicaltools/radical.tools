---
id: "f8171672-749f-4383-a299-5e8788564bb5"
type: "requirement"
label: "Offer to arrange each stage"
action: "Radical Forge shall ask whether to keep the stage's new elements in a row, a column or a grid on the canvas views that show them, and whether to run Smart Layout on each, and shall arrange nothing the user did not choose; on completion it shall place only the stage's elements its views have no place for yet, leaving where they are those laid out while the stage ran; a stage whose elements land in no canvas (only in table, wiki, matrix or Warnier views) is offered nothing to arrange."
ears_type: "event-driven"
rationale: "The user decides how a stage's output is laid out before the next stage adds to it. Since the stage's views exist before its elements (#225), what the user laid out there during the stage was thrown into a grid on completion (exploratory run 30, 2026-10-20). Evidence: RadicalForgeModal.tsx (Arrange panel: arrangeStage, layoutStage); apps/mcp/src/forge.ts (forge_arrange, placeInViews)"
trigger: "a Forge stage completes"
---
