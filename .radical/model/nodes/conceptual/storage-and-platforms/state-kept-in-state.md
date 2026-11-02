---
id: "815318d1-c3ed-4c79-956f-5caf6dcbe8f5"
type: "scenario"
label: "State kept in .state"
given: "a model folder whose .radical/ holds a base.json and a test-results.json from an earlier version"
metrics: |
  test(packages/node-files/tests/stateDir.test.ts) passed
  test(apps/studio/tests/webFolder.test.ts › a repository laid out with .radical/ › opens the model of a repository picked, and reads state the old .radical/ still has) passed
then: "what they write goes into .state/, with a .gitignore; they read base.json from .radical/ until .state/ has one"
when: "the CLI, the MCP server and Studio read and write its state"
---
