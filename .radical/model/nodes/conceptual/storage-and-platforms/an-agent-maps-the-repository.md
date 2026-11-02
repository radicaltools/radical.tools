---
id: "573106d9-3729-43e8-9bc8-bb1e3fbbc0d2"
type: "scenario"
label: "An agent maps the repository"
given: "a repository with its model in .radical/model: a system Shop with containers Orders API and Billing API"
metrics: "test(apps/mcp/src/folderModel.test.ts › repository mapping) passed"
then: "the first lists the three as built nowhere; after the writes .radical/radical.json has both entries, the component is built in Orders API's paths as Orders API is, and remove takes Orders API out; an unknown element and a path outside the repository are refused"
when: "an agent calls get_implementation, set_implementation for Shop and Orders API, get_implementation for a component of Orders API, and set_implementation with remove"
---
