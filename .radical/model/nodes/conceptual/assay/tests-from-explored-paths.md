---
id: "34ac303a-d2d1-4da8-b96a-aeff420e5abc"
type: "requirement"
label: "Tests from explored paths"
action: "the system shall write the path as a Playwright test into the application repository's e2e/assay/, one file per path, finding each control by its role and name and checking each screen it reaches by its heading or address, a password read from E2E_PASSWORD and the test failing plainly when it is not set, with a playwright.config.ts there when there is none, bind the scenario to that test in the repository's .radical/radical.json, and write nothing outside e2e/assay/"
ears_type: "event-driven"
rationale: "An application with no tests of its interface gets them from the paths the user accepted."
trigger: "the user accepts a requirement one of whose scenarios rests on an explored path"
---
