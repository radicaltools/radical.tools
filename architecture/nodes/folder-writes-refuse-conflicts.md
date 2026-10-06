---
id: "6f2e9a6a-ab1c-4773-9904-15ec6348a193"
type: "adr"
label: "Folder writes refuse conflicts"
alternatives: "Last write wins."
consequences: "Studio shows edits made by the MCP server or an editor on the open canvas. A writer re-reads after a refused write."
context: "People edit model files in other editors and through git while Studio or the MCP server has the folder open. Earlier versions lost descriptions, deleted foreign files and overwrote outside edits."
date: "2026-09-30"
decision: "MdFolderSession keeps a baseline of what it read, refuses a write when a file changed outside since then, and polls the folder for outside edits."
status: "accepted"
---
