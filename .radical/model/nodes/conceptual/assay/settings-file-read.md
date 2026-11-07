---
id: "5228bd47-1d6d-47e4-93da-4146d5d84692"
type: "scenario"
label: "Settings file read"
given: "a server repository whose Server.ini says StartPort=24582, and a client repository whose sinfo.dat lists servers as sections with IP=45.235.98.29 and PJ=24582"
then: "the server listens on 24582, the client has the address 45.235.98.29:24582, and the client is linked to the server, inferred, by that port"
when: "Assay reads both"
---
