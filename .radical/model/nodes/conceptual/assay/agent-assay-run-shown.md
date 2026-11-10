---
id: "34a4fbad-7623-409d-b74c-cd2143253754"
type: "scenario"
label: "Agent Assay run shown"
given: "Studio has a model folder open on which an agent runs Radical Assay over MCP"
then: "an Assay button appears beside the Forge button, pulsing as working with 4/7, then as waiting; clicking it opens a read-only view of the seven stages with the repositories and the proposals waiting and Follow on the canvas; it shows paused when the client closed, and no Assay button is shown on a folder with no run"
when: "the run's status file says the Domain stage is working, then that proposals wait, then that the client closed"
---
