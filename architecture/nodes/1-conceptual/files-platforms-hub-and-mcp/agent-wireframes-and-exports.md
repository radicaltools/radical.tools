---
id: "3dffb94f-2822-4e7e-a26e-6a2f731569d3"
type: "scenario"
label: "Agent wireframes and exports"
gherkin: "# Covered by: apps/mcp/src/forge.test.ts › Radical Forge over MCP › draws wireframes, imports Hub concepts and exports the Gherkin files"
given: "a Forge run with a requirement, a mockup that illustrates it and a scenario that verifies it"
then: "the brief names the requirement, the stored wireframe has its script stripped, the pattern lands beside the model and one .feature file holds the scenario"
when: "the agent asks for the mockup's wireframe brief, stores an SVG, imports a Hub pattern and finishes the run into a folder"
---
