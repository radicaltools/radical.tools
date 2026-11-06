---
id: "38d3982c-1d7d-4e66-940b-4990146b3074"
type: "scenario"
label: "Database and tables read"
given: "a VB6 form with an ADO connection string to SQL Server and SQL that selects from two tables, and a Spring application.yml with a JDBC URL"
then: "each unit has a database fact with its engine and name, and the VB6 unit has a table fact for each table"
when: "Assay reads them"
---
