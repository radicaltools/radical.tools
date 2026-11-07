---
id: "1876c841-7d57-4106-a451-698b5ef22a18"
type: "scenario"
label: "Views and system tables left out"
given: "a schema creating a table and a view, and code whose SQL selects from the view, the table and sysdatabases"
then: "only the table is a table fact"
when: "Assay reads the repository"
---
