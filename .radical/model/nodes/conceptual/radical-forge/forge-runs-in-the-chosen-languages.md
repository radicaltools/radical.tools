---
id: "4dd725e1-40e3-4cab-90bb-dfce54b671f1"
type: "scenario"
label: "Forge runs in the chosen languages"
given: "an agent connected to the radical MCP server"
metrics: "test(apps/mcp/src/forge.test.ts › Radical Forge over MCP › asks for the languages first and keeps them for the run) passed"
then: "the procedure asks for the languages before the view structure; the run reports both, and the clarify and stage briefs say to talk to the user in Polish and to write the model in German; without languages the run talks in the language of the description and writes the model in English"
when: "it starts a Forge run with the conversation in Polish and the model in German, clarifies and generates the requirements stage, and another run is started without languages"
---
