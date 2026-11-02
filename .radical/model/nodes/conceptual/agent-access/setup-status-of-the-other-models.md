---
id: "3d5374dd-4663-4f3b-9613-25642fa29509"
type: "scenario"
label: "Setup status of the other models"
given: "a model whose deps.json names standards, not fetched, then fetched, then pinned to another version"
metrics: "test(apps/cli/src/status.test.ts › radical setup --status › shows the models this one depends on, and warns when they are not fetched or pinned anew) passed"
then: "it warns that nothing is fetched, then lists standards with its version and commit, then warns that deps.json pins another version than the one fetched"
when: "radical setup --status runs after each"
---
