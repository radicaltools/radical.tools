---
id: "34fbca3d-ebe2-4c83-b07f-4c9336e16eff"
type: "adr"
label: "Canvas selection in model folder"
alternatives: "A local HTTP or WebSocket bridge between Studio and the MCP server (a port to manage, impossible from a browser tab without a server). Storing the selection in a model file (would make every click a model change and a git diff). An MCP resource instead of a tool (agents call tools on their own, resources need an explicit mention)."
consequences: "Works in Electron and the browser with no new channel or port. The file is outside the model paths, so it never trips folder-session conflicts or the outside-edit watcher. A selection can be stale when Studio closes without switching models; get_selection reports updatedAt and secondsAgo. Two Studio windows on one folder: the last selection wins."
context: "People select an element on Studio's canvas and ask a coding agent to change it (\"fix the selected mockup\"). The MCP server is a separate local process bound to the same model folder; Studio runs in Electron or in a browser with File System Access, so there is no shared process or socket between them."
date: "2026-10-08"
decision: "Studio writes the canvas selection (view on screen, selected node and relation ids, time) to .radical/selection.json in the open model folder, debounced, and an empty selection when the user leaves the model. .radical/ carries its own .gitignore. The MCP server's read-only get_selection tool reads it and resolves the ids against the model."
status: "accepted"
---
