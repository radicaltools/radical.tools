---
id: "82eb0e10-6923-419a-8f26-96665d53592d"
type: "scenario"
label: "Schema outside every project read"
given: "a repository whose T-SQL schema, in UTF-16, lies at its root beside three projects whose code names some of its tables"
then: "each of the three units has every table the schema creates, declared, with its columns"
when: "Assay reads the repository"
---
