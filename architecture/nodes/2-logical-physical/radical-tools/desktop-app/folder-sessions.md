---
id: "f53d7ad3-d926-404d-9341-9cb61722979d"
type: "component"
label: "Folder sessions"
technology: "Electron IPC, MdFolderSession"
---

folder:open/pick/read/write/watch. One MdFolderSession per folder; writes return a conflict when the folder changed on disk, and the active folder is polled every second for outside edits (folder:external-change).
