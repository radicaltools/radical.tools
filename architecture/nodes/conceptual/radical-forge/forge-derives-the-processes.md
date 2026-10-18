---
id: "c79e5b77-b0b4-4d00-884c-bcf9cf53cce1"
type: "scenario"
label: "Forge derives the processes"
given: "a Forge run whose state machines stage is completed"
tests: |
  packages/common/tests/forgePrompts.test.ts › processes
  packages/common/tests/forgeViews.test.ts › processes go into a Warnier view
  apps/mcp/src/forge.test.ts › runs the processes stage after the state machines
then: "the stage comes eighth of eight after State machines, its prompt asks for ordered steps with repetition, choice and concurrency, verifies and satisfies; the process lands in a Processes view of the viewpoint Process (Warnier) and is offered nothing to arrange; the C4 prompt asks for performed-by"
when: "the Processes stage is generated, a process with ordered steps is added, the stage is completed, and the C4 stage runs"
---
