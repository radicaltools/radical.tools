---
id: "1300e9b1-3b19-4700-9c95-5d25808ee887"
type: "requirement"
label: "Forge makes stage views first"
action: "Radical Forge shall make the views the stage's elements will show in before the stage adds any: the stage's layer canvas, listing nothing yet rather than every element, or in the Radical structure a view of each chosen viewpoint of the stage and the group of a viewpoint that draws one element; it shall keep the views the model has, say over MCP which views it made, and take back those the stage left showing nothing when it completes"
ears_type: "event-driven"
rationale: "Each element shows up in its view as the stage adds it, so the user, and Studio following the agent, can watch the stage build. Views left empty would clutter the list. Evidence: packages/common/src/ai/forge/views.ts (openForgeStageViews, dropEmptyForgeViews), apps/mcp/src/forge.ts (generate, complete), apps/studio/src/renderer/src/components/RadicalForgeModal.tsx"
trigger: "a Radical Forge stage begins (forge_generate over MCP, Generate in Studio's wizard)"
---
