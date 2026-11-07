---
id: "c845e0b3-1a8e-4359-a6df-9ba027b3a882"
type: "scenario"
label: "Connection templates of a library left out"
given: "a VB6 library whose database class holds connection strings for Access, ODBC, SQL Server and MySQL"
then: "it has no database fact, and a note names the file of templates"
when: "Assay reads the repository"
---
