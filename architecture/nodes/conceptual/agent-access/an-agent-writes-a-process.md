---
id: "3f19abaf-6672-47b2-ba77-35b8d28fd81c"
type: "scenario"
label: "An agent writes a process"
given: "a model folder open in the MCP server"
tests: "apps/mcp/src/folderModel.test.ts › warnier"
then: "the files hold the steps with their properties, the view is of kind warnier, and get_issues finds nothing"
when: "an agent adds a process with steps and their repeat, condition, order and children, and creates a view of the viewpoint Process (Warnier)"
---
