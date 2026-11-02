---
id: "6f2e9a6a-ab1c-4773-9904-15ec6348a193"
type: "adr"
label: "Folder writes refuse conflicts"
alternatives: "Last write wins."
consequences: "Studio shows edits made by the MCP server or an editor on the open canvas. A writer re-reads after a refused write. Amended 2026-10-14 (exploratory run 6): a JSON file of the folder that is there but does not parse (a trailing comma, git conflict markers, a file caught half written) is an error that names the file (MalformedFolderFileError in deserializeFromMdFolder), not a missing file. It used to read as empty: Studio showed the model without its relations, views or layout and removed the file as stale on the next save. Studio now tells the user which file it is, keeps the model that was on screen when the file broke while the folder was open, and refuses every save to that folder until a read succeeds (DocumentUnreadableError in the document store); the folder is still watched, so the fix arrives as an outside edit. The MCP server already refused such a folder. Amended again 2026-10-14 (runs 9 and 12): a node .md file with git conflict markers is the same error (it was skipped as no node, and the next save dropped its layout); front matter keys that are not letters, digits, _ or - are written JSON-quoted and read back (a property keyed \"SLA target\" was lost); a node the layout file does not know gets its type's size instead of 0x0."
context: "People edit model files in other editors and through git while Studio or the MCP server has the folder open. Earlier versions lost descriptions, deleted foreign files and overwrote outside edits."
date: "2026-09-30"
decision: "MdFolderSession keeps a baseline of what it read, refuses a write when a file changed outside since then, and polls the folder for outside edits."
status: "superseded"
---
