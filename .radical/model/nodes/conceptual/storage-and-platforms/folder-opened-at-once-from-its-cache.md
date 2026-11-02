---
id: "b7259762-2a1a-403e-9c23-0d6a3ad532ce"
type: "scenario"
label: "Folder opened at once from its cache"
given: "a folder whose cache holds its files; and in Studio a folder model opened once, renamed in, then closed while a name and an element's place change in its files"
then: "the open lists no file and reads none, and the listing right after finds nothing changed; when a file changed, the listing names it and the next read has it as it is; Studio's rename is in the cache's changes.json, and reopened Studio shows the new name and the element where the file has it now; a drag while an outside write comes in still lands under the pointer and is what is saved"
when: "a session opens it as its cache has it; then one of its files changes before the next open; Studio opens the folder model again"
---
