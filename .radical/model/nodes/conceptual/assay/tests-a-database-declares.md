---
id: "1f67638a-48ac-4586-b106-25a772577b4c"
type: "scenario"
label: "Tests a database declares"
given: "a schema with a utPLSQL suite of contexts, a disabled test, a test named by --%displayname and a suite a body builds in a string, and a Sqitch schema with pgTAP scripts of described and undescribed assertions, -- inside a dollar-quoted string, and a test function runtests() runs"
then: "each test is a fact by its file and titles, not run (the disabled one skipped), in the schema's unit, which tests with utPLSQL or pgTAP; the suites are no routines; the plan is accepted; and the pending test is a disabled utPLSQL test or a pgTAP TODO whose id the reader gives back"
when: "Assay reads them, and a plan rests a scenario on a test not run, and a scenario drawn from the code is accepted"
---
