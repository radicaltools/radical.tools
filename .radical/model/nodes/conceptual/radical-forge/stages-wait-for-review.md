---
id: "5a59d3d9-db85-49bf-a901-61544b13bc08"
type: "scenario"
label: "Stages wait for review"
given: "a Radical Forge run started from a brief"
then: "Studio offers the next stage only after the user clicks Continue; over MCP a later stage is refused while the open one is not complete, and a completed stage runs again only with regenerate, which replaces what it added"
when: "a stage has been generated"
---
