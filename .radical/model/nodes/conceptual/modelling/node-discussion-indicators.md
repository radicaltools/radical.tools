---
id: "416302f9-21b1-4296-97ef-0ee24cf9c004"
type: "scenario"
label: "Node discussion indicators"
given: "a folder model with per-node discussions and a graph whose discussion panel is closed"
then: "nodes with threads show a top-right speech-bubble marker with thread/open counts, including all-resolved conversations; markers refresh while closed and open the correct node panel, stay outside model exports, and unchanged counts or draft edits do not repaint the canvas; the panel and canvas share one poll that stops when both leave"
when: "a thread is posted or resolved, discussion data changes externally, the folder is reopened, or the user clicks or keyboard-activates a node's discussion marker; or the view is exported as an image"
---
