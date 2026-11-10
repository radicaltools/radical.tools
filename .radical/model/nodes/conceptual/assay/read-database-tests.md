---
id: "6ede1867-514a-4579-a8de-b9763f300f7d"
type: "requirement"
label: "Read database tests"
action: "the system shall record each test they declare as a test fact with status not run (skipped when utPLSQL's --%disabled marks it or its suite), its id its file and titles (utPLSQL: the suite, its contexts and the test, each by its description or else its name; pgTAP: an assertion of a test script by its description, else #n, its number in the script; a test function runtests() runs by its name), in the unit whose folder holds it, else the database unit whose routines or tables it uses, and record that unit's test framework as utPLSQL or pgTAP; a report naming the test gives its status; a suite, context or test may be named by --%displayname as older suites are, a context's own --%context(name) first; strings are read past, so a suite a body builds in a string is none; a pgTAP description may be built by an expression ('… ' || f), its text the title, or an E'…' string with its escapes, and a type a structure test takes (col_type_is(t, c, 'timestamp with time zone')) or PostgreSQL's own has_table_privilege() is none; a file is a pgTAP test when it plans, finishes or runs tests, or defines test functions, not because a function returns SETOF TEXT"
ears_type: "event-driven"
rationale: "Database code is tested in the database: without these tests a scenario of a stored routine's behaviour rests on nothing, though the repository checks it."
trigger: "a repository holds utPLSQL test packages or pgTAP tests"
---
