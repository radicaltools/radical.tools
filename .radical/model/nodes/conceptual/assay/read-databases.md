---
id: "c9e097db-0354-4000-be0b-36b845e7f2bf"
type: "requirement"
label: "Read databases"
action: "the system shall read the database it connects to, with its engine, server and name where given (a connection string naming its engine's ODBC driver or OLE DB provider is a database even when its server and name are filled in at run time), a database an SQL file creates (CREATE DATABASE), in the engine its dialect shows, as a database of the unit that holds the file, and the tables its SQL names, its SQL files create and its data controls read, as facts of that unit; connection strings of three or more engines in one file are a library's templates, not databases it uses, and are left out with a note"
ears_type: "event-driven"
rationale: "The data a system keeps is part of its architecture in old code and new; a VB6 form's SQL is often the only description of its tables."
trigger: "a unit's configuration or code holds a connection string (ADO or OLE DB, ODBC, JDBC, .NET, or a database URL), SQL naming tables, an SQL file creating tables, or a VB6 form's data control with its record source"
---
