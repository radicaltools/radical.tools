---
id: "ae71db46-0614-4310-95b7-6d6ed8f54a52"
type: "adr"
label: "The model names its tests"
alternatives: "Test ids as tags in the test code (`@REQ-12`): ties every test file to the model's ids and puts them in a second place. Writing the status into the model's files: every CI run would change files in git. Gherkin feature files run by Cucumber: the repository's tests are plain Vitest and Playwright, and rewriting them is out of proportion."
consequences: "A renamed or deleted test fails the check (test-not-found) in the run that would have run it, and a failing test names the requirements or ADRs it leaves unverified. Test reports from runners other than JavaScript ones work through JUnit XML. Matching by title means a renamed test needs its id updated in the model too. Each CI run can produce evidence without a commit to the model. A check that is no test runner (a script such as test-package.mjs, tools/check-workspaces.mjs, a benchmark) cannot be named yet."
context: "117 scenarios named their tests in a `# Covered by:` comment in the gherkin field and the fitness functions in prose in their descriptions. Nothing could tell when such a test was renamed or deleted: the first check of them against real reports found four stale bindings (two titles cut short, one test moved to another file, one test gone since #176). Requirements and ADRs had no status a person or an agent could read."
date: "2026-10-14"
decision: "Scenarios and fitness functions have a `tests` property: one test id per line, `<file> › <title>` as Vitest and Playwright print them. An id names the test whose title it ends, else every test in the describe block it starts; an id without a title names every test in the file or directory. `radical check --report` reads Vitest/Jest JSON, Playwright JSON and JUnit XML reports and looks the ids up; with --evidence it writes the status of each scenario, fitness function, requirement and ADR to a JSON file. The evidence never goes into the model's files."
status: "accepted"
---
