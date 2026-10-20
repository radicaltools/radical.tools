---
id: "22e5bd71-808a-4811-bf44-b60037c28d81"
type: "scenario"
label: "radical --version"
given: "the radical command line"
tests: "apps/cli/src/cli.test.ts › prints the product version with --version"
then: "it prints the version of its package.json, with +<commit> unless built from the release tag, and exits with 0; the installed npm package does the same"
when: "the user runs radical --version, or radical -v"
---
