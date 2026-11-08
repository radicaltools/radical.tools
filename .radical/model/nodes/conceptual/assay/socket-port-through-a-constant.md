---
id: "0f323673-7507-4817-943e-226e14860f8d"
type: "scenario"
label: "Socket port through a constant"
given: "a VB6 client whose socket connects to GAME_IP and GAME_PORT, set from a record its code fills with 127.0.0.1 and 7777, and a VB6 server listening on a constant GAME_PORT = 7777"
then: "the client calls the server, by the port the server listens on"
when: "Assay reads and links them"
---
