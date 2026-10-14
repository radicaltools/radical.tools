---
id: "de0350a3-84b0-48d4-b255-0718049b181e"
type: "requirement"
label: "Folder properties"
action: "Studio shall show the folder's name, the folder it sits in, its place among the folders beside it and the views in it and below it; rename it, every view in it and below it moving along, refusing an empty name or one with \"/\"; and move it up or down among the folders beside it; each change one undo step."
ears_type: "event-driven"
rationale: "Folders are kept on the views, so renaming or ordering one view at a time would be slow and error-prone. Evidence: packages/common/src/model.ts (renameViewFolder, moveViewFolder), packages/common/src/c4.ts (viewFolderRenameTarget), packages/ui/src/components/RightPanel.tsx (FolderPropertiesContent); manual#views"
trigger: "the user opens a folder's properties with the gear on its row in the list of views"
---
