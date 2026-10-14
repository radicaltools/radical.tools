---
id: "e48c16ec-0861-48b3-b23d-9a2d7e2dd1a6"
type: "state-machine"
label: "Forge run lifecycle"
---

How an agent's run over MCP goes, as forgeRunStatus.ts and the forge_* tools of apps/mcp/src/forge.ts have it. Studio shows the phase: working while a stage generates, waiting while the run waits for the user, done, paused when the client went away or nothing changed for 30 minutes.
