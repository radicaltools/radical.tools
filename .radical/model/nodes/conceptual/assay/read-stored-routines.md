---
id: "b3b95a29-1149-4f2e-a5cb-99edbb77df64"
type: "requirement"
label: "Read stored routines"
action: "the system shall record each routine as a routine fact with its name (an Oracle package's member as package.member), its kind (procedure, function, package, trigger) and dialect (Oracle's PL/SQL, SQL Server's T-SQL, PostgreSQL's PL/pgSQL, MySQL), the table a trigger is on and the function a PostgreSQL trigger runs, and the tables its body reads and writes and the routines it calls among those the repository knows, each with its file and line; a package's members are the procedures and functions at its top level, not the subprograms declared inside a member; comments and strings are read past in one pass (a string may hold --, run over several lines, or be Oracle's q'[…]'); the routines are those of the database's final state: one a script drops and creates no more after is gone (an installer's helpers dropped at its end), while a teardown script (named for dropping, uninstalling or cleaning up, or one that drops and creates nothing and is no versioned migration) and Sqitch's revert/ and verify/ scripts drop nothing; a routine in a unit's folder, or in a script of the one unit using it, is that unit's, and one in no unit's folder the database's own"
ears_type: "event-driven"
rationale: "Much of the logic of systems on Oracle, SQL Server or PostgreSQL lives in the database: a model without its routines misses what the code calls and what changes the tables."
trigger: "a repository holds a database's scripts creating procedures, functions, Oracle packages or triggers (.sql, and Oracle's .pks, .pkb, .prc, .fnc, .trg and the like)"
---
