---
id: "33421548-8635-4917-8793-ba89753d6de0"
type: "requirement"
label: "Forge saves a base without git"
action: "Radical Forge shall save the model as it is before the run as the folder's base, marked as the start of a Forge run, so that Changes on branch and the Inspector's Changes tab show what the run changes; a base saved from git it shall leave as it is"
ears_type: "event-driven"
rationale: "Studio shows changes only against .radical/base.json, which git hooks and get_changes write; a folder outside git, often a new empty one Forge fills, never got one, so nothing a run added showed as new. Evidence: packages/common/src/formats/modelBase.ts (forgeModelBase, mayReplaceWithForgeBase); apps/mcp/src/folderModel.ts; apps/studio/src/renderer/src/components/RadicalForgeModal.tsx (startRun)"
trigger: "a Radical Forge run starts on a model folder that has no base from git (no .radical/base.json, an unreadable one, or one an earlier Forge run saved), in Studio or over MCP"
---
