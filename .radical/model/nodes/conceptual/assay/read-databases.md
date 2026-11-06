---
id: "c9e097db-0354-4000-be0b-36b845e7f2bf"
type: "requirement"
label: "Read databases"
action: "the system shall read the database it connects to, with its engine, server and name where given, and the tables its SQL names, as facts of that unit"
ears_type: "event-driven"
rationale: "The data a system keeps is part of its architecture in old code and new; a VB6 form's SQL is often the only description of its tables."
trigger: "a unit's configuration or code holds a connection string (ADO or OLE DB, ODBC, JDBC, .NET, or a database URL) or SQL naming tables"
---
