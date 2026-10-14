---
id: "d4fa1d4a-8211-4364-9ad5-37e6cacc2b3a"
type: "state-machine"
label: "Folder model in Studio"
---

A model kept in a Markdown folder, as Studio holds it (documentStore.ts, mdFolderSync.ts): it loads, waits for access in a browser after a reload, follows outside edits, and refuses to write over files that changed since it read them.
