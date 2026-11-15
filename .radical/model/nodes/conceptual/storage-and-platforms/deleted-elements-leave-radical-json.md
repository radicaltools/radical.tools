---
id: "dde90528-bef5-4c6d-9aa9-d3ebf37599cc"
type: "requirement"
label: "Deleted elements leave radical.json"
action: "the server shall take their entries out of the file and say so in its answer"
ears_type: "event-driven"
rationale: "Entries of deleted elements stayed in the file and were warned about by every check after (F-0110, round 201–210). Studio's delete, which Undo takes back, leaves them, and radical check warns about them (Mapping checked); radical implement --remove and radical verify --remove take them out. Evidence: apps/mcp/src/folderModel.ts"
trigger: "an agent deletes elements through the MCP server that have entries in the repository's .radical/radical.json (an element's paths, a scenario's or fitness function's tests)"
---
