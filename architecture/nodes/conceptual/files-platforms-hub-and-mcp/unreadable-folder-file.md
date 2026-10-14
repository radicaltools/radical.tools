---
id: "f0c39b24-2ad5-4ba7-be35-3994ecad9adb"
type: "requirement"
label: "Unreadable folder file"
action: "Studio shall name the file in an error notification, keep the model that was on screen when the folder was reloaded (or open an empty one when the folder was being opened), write nothing to the folder until the file reads again, and reload the model once the file changes."
ears_type: "unwanted-behaviour"
rationale: "An unreadable relations.json used to read as no relations, and the next save removed the file. Evidence: apps/studio/src/renderer/src/store/documentStore.ts (DocumentUnreadableError, mdUnreadable, saveDocument), apps/studio/src/renderer/src/persistence/autosave.ts (loadActive catch), packages/common/src/formats/mdFolder.ts (MalformedFolderFileError)."
unwanted_condition: "a JSON file of the open folder model cannot be parsed (a trailing comma, git conflict markers, a file caught half written)"
---
