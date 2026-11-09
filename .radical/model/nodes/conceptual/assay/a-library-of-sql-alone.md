---
id: "be64de56-85e2-41f5-ae9b-d4b431ee629a"
type: "scenario"
label: "A library of SQL alone"
given: "a repository of PL/SQL with source/ installing its packages by @@, a coverage folder of code and a report, an uninstall script, examples whose runner creates and drops a procedure, and a developer's profiling package in development/"
then: "source and examples are its units, the packages and their members are read past Oracle's $$NO_OP flag, the example's procedure is dropped, the profiling package is none, and the examples call source"
when: "Assay reads it"
---
