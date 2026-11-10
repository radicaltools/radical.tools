---
id: "513b7e1d-0d76-4a74-9d73-8fa1f3912fcf"
type: "adr"
label: "Database tests declared in code are facts not run"
alternatives: "Reports only: database repositories rarely hold them, so their scenarios would keep resting on nothing. Declared tests for every stack: a larger change to what the benches and the repositories already read, for frameworks whose reports are common."
consequences: "A scenario of a database's behaviour rests on the test that checks it, and radical check shows it not run until a report says otherwise. An agent sees a repository's database tests in assay_start. Reports of utPLSQL and pg_prove still have to be read for those statuses (TAP; utPLSQL's JUnit names no file)."
context: "Assay knew tests only from the reports runners write. A database's tests are seldom run where Assay reads them: Schemaverse's 12 pgTAP files and utPLSQL's 1 122 --%test procedures gave no test facts, so every scenario of the database's code said no test checks it, though tests/010_registration.sql:13 checks exactly a name with SQL in it being refused. The agent of run 27 read them by hand."
date: "2026-11-10"
decision: "A test a database's code declares is a test fact with status not run: a utPLSQL --%test procedure of a --%suite package (skipped when --%disabled), a pgTAP assertion of a test script, or a pgTAP test function runtests() runs. Its id is its file and titles: utPLSQL's suite, contexts and test, each by its description or else its name; a pgTAP assertion by its description, else #n, its number in the script as TAP counts it; a test function by its name. A report naming it gives its status. Its unit's test framework is utPLSQL or pgTAP, so a scenario drawn from a database's code gets a pending test of it. Other stacks keep reports only for now."
status: "accepted"
---
