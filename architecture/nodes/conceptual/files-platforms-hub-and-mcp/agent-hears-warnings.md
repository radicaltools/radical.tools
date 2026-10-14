---
id: "2e9c91b9-1594-457c-88da-ba1c826a07f2"
type: "scenario"
label: "Agent hears warnings"
given: "an agent building a state machine through the MCP server"
tests: "apps/mcp/src/folderModel.test.ts › state machines over MCP › are offered, explained, built with event references, checked and laid out"
then: "the write succeeds and its result lists the new warning naming the state; a transition trigger that is no event is refused; get_issues reports no issues once the machine is complete"
when: "it adds a compound state without an initial pseudostate, and later calls get_issues on the finished machine"
---
