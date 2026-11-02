---
id: "ce02b77e-004e-4160-9736-b85575aeff38"
type: "scenario"
label: "Agent forges and regenerates"
gherkin: "And asking for the fitness stage while requirements is open is refused"
given: "an MCP client connected to an empty governance model folder"
then: "the brief is a need with source Radical Forge, the stage task carries the need id and the user's answers, and after regenerating the folder holds only the need"
when: "it starts Forge with a brief, clarifies and generates the requirements stage, adds a requirement, completes the stage and regenerates it"
---
