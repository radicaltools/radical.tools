---
id: "10e5d2fc-c37a-48f9-afb5-fad88a5392b9"
type: "requirement"
label: "Large model folders load fast"
action: "it shall read several files at a time rather than one after another."
ears_type: "event-driven"
rationale: "Opening a model folder of 21,000 files took Studio 25 s, about 11 s of it waiting on files read one after another; the MCP server reads the whole folder on every tool call, 4 s for 21,000 files on disk one by one and 2 s with 64 at a time (2026-10-30). Evidence: packages/common/src/formats/mdFolderSync.ts (MdFolderSession.loadBaseline), apps/studio/src/renderer/src/persist/webFolder.ts (handleFolderStorage)"
trigger: "Studio or the MCP server reads a model folder of 20,000 files"
---
