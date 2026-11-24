---
id: "2d61e95a-f9a7-4196-a8fb-c840b982ab80"
type: "scenario"
label: "Step outside verify found"
given: "a pull request that adds a step running npx eslint . to a pull-request workflow"
then: "it fails until the step runs a package.json script that npm run verify runs as well"
when: "the mirror check runs"
---
