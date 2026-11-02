---
id: "ae65aad2-e11a-4c6e-a8c6-8cad714d817a"
type: "scenario"
label: "Folder opened from its cache"
given: "a model folder of 300 files read once, so its cache holds them; and a folder on disk"
then: "the second read reads no file; then only the changed files, named in changes.json, and the read after reads none; the written file is read from the cache; after sixty model.json is written again; a broken cache is rebuilt from the whole folder; a changes.json for another model.json is left out; a folder whose cache cannot be written opens all the same; on disk the cache sits in .state/cache/, is read, and is written again when deleted; the cache file is ASCII and reads back every character"
when: "it is read again; three files change or go and it is read again, and again; the session writes a file and the folder is read again; sixty files change; its cache is broken or of another version; changes.json was made for another model.json; it cannot be written; the cache on disk is changed for a file and then deleted; files with characters outside ASCII are cached"
---
