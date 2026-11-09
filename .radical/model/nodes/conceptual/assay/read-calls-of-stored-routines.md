---
id: "67c60d95-774c-4f55-978a-9ad63e9f256a"
type: "requirement"
label: "Read calls of stored routines"
action: "the system shall link the calling unit to that routine as an observed call, the routine its own repository creates first, else any repository's, else one known only from the calls (a routine the database holds), reading: JDBC's call escape ({call x(?)}, in code or in a MyBatis mapper's XML), a PL/SQL block in a string (BEGIN pkg.proc(:a); END;), CALL with its parentheses and EXEC in a string of SQL, each on the string's own line, Spring's SimpleJdbcCall (withProcedureName, withFunctionName, in the package withCatalogName names), JPA's @Procedure, procedureName and createStoredProcedureQuery, ADO.NET's and Dapper's commands of CommandType.StoredProcedure, VB6's adCmdStoredProc, Python's callproc and callfunc, a name a string constant of the repository's Java, Kotlin or C# holds (IConstants.F_RAISE), and a function a query selects (SELECT f($1), FROM f()) only where the repository creates a routine of that name; VB's comments, a caption (Call failed (%1)) and an annotation's text are no calls; a database project's script calling a routine another one creates (pkg.proc; or pkg.proc(…)), by its exact name, in its own dialect and not one its own project creates, or holding a table whose foreign key references a table only another one creates (another schema's), depends on that project"
ears_type: "event-driven"
rationale: "The calls of stored routines are the edges between an application and its database's logic: without them the database is a box with no way in."
trigger: "a unit's code, or a database project's script, calls a stored routine"
---
