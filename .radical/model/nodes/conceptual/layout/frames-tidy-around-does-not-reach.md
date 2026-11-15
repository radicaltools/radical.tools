---
id: "5b880c7f-bc2d-431a-8722-e95aefb6fd14"
type: "scenario"
label: "Frames Tidy around does not reach"
given: "a view with a pinned frame and a frame far from the selection, each larger than its children need"
then: "both frames keep their place and size, also after the store's and the server's refit; a frame is fitted only round something in it that moved, and none round what the view shows when nothing in it moves"
when: "Smart Layout tidies around a selection, in Studio or through the MCP server, and again with nothing in a frame that moves"
---
