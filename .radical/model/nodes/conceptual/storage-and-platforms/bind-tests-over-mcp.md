---
id: "f6785c8c-19a2-42b5-ace7-61f685b95941"
type: "requirement"
label: "Bind tests over MCP"
action: "the server shall list the tests bound to a scenario or fitness function, or every entry with the scenarios the repository verifies that have none; bind the tests set_verification is given beside those bound, as radical verify --test does, unbind those drop names, and with remove take the entry out, also one whose element the model no longer has; a test id written as Vitest prints it (file > describe > title) it shall keep in the › form"
ears_type: "event-driven"
rationale: "set_verification replaced an element's tests with those it was given, while radical verify --test adds them, so an agent binding one more test unbound the others (F-0111, round 201–210). Evidence: apps/mcp/src/folderModel.ts (set_verification, removeOrphan)"
trigger: "an agent calls get_verification or set_verification on the MCP server"
---
