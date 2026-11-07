---
id: "2a7a9344-d59a-4242-bf09-eca8211bc099"
type: "scenario"
label: "Connection named by the scripts' database"
given: "35 VB6 projects whose connection library opens SQL Server through ODBC with a database from a variable, and T-SQL scripts that USE ADRRBR01 and create its tables"
then: "the library is linked to the SQL Server database ADRRBR01, and the scripts' tables are its"
when: "Assay reads them"
---
