---
id: "40153159-9bc8-49f5-8161-9feb40bdce0f"
type: "scenario"
label: "Environment database read"
given: "a Laravel application whose .env.example sets DB_CONNECTION=sqlsrv and DB_DATABASE=AINData2"
then: "the application is linked to the SQL Server database AINData2"
when: "Assay reads it"
---
