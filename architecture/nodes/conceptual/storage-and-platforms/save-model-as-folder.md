---
id: "1b3d6d74-456f-460b-8e44-d905a1bb475c"
type: "requirement"
label: "Save model as folder"
action: "Studio shall write the model as a Markdown folder into the picked folder and turn the entry into a folder-backed model."
ears_type: "event-driven"
rationale: "The folder format is what git diffs and the MCP server work on. Evidence: apps/studio/src/renderer/src/store/documentStore.ts:841-904; apps/studio/src/renderer/src/components/DocumentManager.tsx:117-125,403-405; manual#documents"
trigger: "the user chooses Save as folder… and picks a folder"
---
