---
id: "eef82864-3cd3-44c7-95e5-649d4f844d86"
type: "requirement"
label: "Read-only folder is read"
action: "radical check, radical diff and the MCP server shall read, check, compare and serve the model, a read taking no write turn there and waiting only while another program is writing"
ears_type: "state-driven"
precondition: "the model folder, or its .radical folder, may only be read"
rationale: "A read took a write turn through .radical/write.lock, so a folder the user may only read (a checkout mounted read-only, another user's files) could not be checked or served (exploratory runs 45 to 64, 2026-10-21, item 175). Evidence: packages/node-files/src/diskFolderStorage.ts"
---
