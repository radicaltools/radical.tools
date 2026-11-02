---
id: "2b57eecd-f114-4aee-b385-e5aae10b6075"
type: "scenario"
label: "Folder read several files at a time"
given: "a folder of 300 model files whose every read takes a moment"
then: "more than one file is read at once, never more than 32, each content lands under its own path, and the session holds the folder as it is"
when: "the folder is read, and a session opens it"
---
