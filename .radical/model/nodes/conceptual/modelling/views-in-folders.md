---
id: "1bfcb405-1c9a-43dd-8872-e182c709b3e9"
type: "requirement"
label: "Views in folders"
action: "Studio shall keep the view under that folder path, with slashes nesting folders, and show the list of views as a tree of folders that open and close, folders and views in the order the model keeps them, a folder standing where its first view does, opening the folder of the active view; an empty folder puts the view back at the top."
ears_type: "event-driven"
rationale: "A model with dozens of views needs its list grouped, as C4 levels, domains or state machines. The folder is set in one place, the view's properties, not on the view card. Evidence: packages/common/src/c4.ts (viewFolderTree), packages/common/src/model.ts (setViewFolder), packages/ui/src/components/RightPanel.tsx (ViewList, ViewFolderPicker, ViewPropertiesContent), packages/common/src/ai/tools/viewTools.ts; manual#views"
trigger: "the user sets a view's Folder in its properties (Move to folder…), or an agent sets a view's folder"
---
