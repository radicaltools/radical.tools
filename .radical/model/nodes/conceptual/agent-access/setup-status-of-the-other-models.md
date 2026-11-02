---
id: "3d5374dd-4663-4f3b-9613-25642fa29509"
type: "scenario"
label: "Setup status of the other models"
given: "a model whose deps.json names standards, not fetched, then fetched, then pinned to another version"
then: "it warns that nothing is fetched, then lists standards with its version and commit, then warns that deps.json pins another version than the one fetched"
when: "radical setup --status runs after each"
---
