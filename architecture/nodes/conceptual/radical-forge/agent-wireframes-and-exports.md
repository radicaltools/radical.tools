---
id: "3dffb94f-2822-4e7e-a26e-6a2f731569d3"
type: "scenario"
label: "Agent wireframes and exports"
given: "a Forge run with a requirement, a mockup that illustrates it and a scenario that verifies it"
metrics: "test(apps/mcp/src/forge.test.ts › Radical Forge over MCP › draws wireframes, imports Hub concern packs and exports the Gherkin files) passed"
then: "the brief names the requirement, the stored wireframe has its script stripped, the concern pack lands beside the model and the .feature files hold the model's scenario and the pack's"
when: "the agent asks for the mockup's wireframe brief, stores an SVG, imports the Authentication concern pack and finishes the run into a folder"
---
