---
id: "37d66e19-979e-4f41-a403-401167f33b64"
type: "scenario"
label: "Facts read from a repository"
given: "a repository with npm workspaces, an OpenAPI description and a test report"
then: "its .radical/assay/facts.json lists each workspace as an app or a library with its dependencies, the API's paths, the URL paths its code names and the report's tests, each with its file and line, and no model changed"
when: "radical assay extract runs on it"
---
