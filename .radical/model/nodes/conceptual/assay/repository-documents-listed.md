---
id: "ddfe4d0c-cbb8-42ae-95c2-625954c093ae"
type: "scenario"
label: "Repository documents listed"
given: "a repository with a README, docs/architecture.md and docs/adr/0001-use-postgres.md"
then: "each is a document fact with its title and headings, and no file is copied"
when: "Assay reads it"
---
