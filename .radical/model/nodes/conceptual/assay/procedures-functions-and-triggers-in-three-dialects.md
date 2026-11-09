---
id: "c3521fce-7786-4b8d-8903-003927f18fef"
type: "scenario"
label: "Procedures, functions and triggers in three dialects"
given: "a SQL Server procedure, a PostgreSQL function and a trigger of the same name running it, and a MySQL procedure between DELIMITER lines"
then: "each routine has its kind and line, the procedure writes orders, and the PostgreSQL trigger is on film and calls last_updated"
when: "Assay reads them"
---
