---
id: "ac2e385c-6e43-467b-9fb9-021599d48719"
type: "scenario"
label: "Database named by its schema"
given: "a VB6 program whose connection string is built at run time, and a T-SQL schema in its folder that creates the database uits_gst_db"
then: "the unit has a SQL Server database fact named uits_gst_db, and the program is linked to it"
when: "Assay reads the repository"
---
