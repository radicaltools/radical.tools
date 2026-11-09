---
id: "b685575b-9faa-4411-9aa6-088aa2772f60"
type: "scenario"
label: "Schemas, Sqitch, PGDATABASE and selected functions"
given: "Oracle's hr and oe schemas, oe's foreign key to hr.employees in an ADD ( … ) list and an object table, a drop-only script beside each, and a Sqitch project with a partition, a sequence, a function and a revert/ script, beside a Go unit whose compose service sets PGDATABASE and a web app naming https://schema.org"
then: "oe depends on hr, the tables survive the drop scripts, the Sqitch project is a sql unit with event_default, the Go unit's database is game, its SELECT register_player() calls the function while count( and the sequence and SELECT INTO's target name nothing, and schema.org names no unit"
when: "Assay reads and links them"
---
