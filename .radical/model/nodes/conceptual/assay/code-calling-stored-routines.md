---
id: "1a6188ec-7604-4997-820a-35494ced8991"
type: "scenario"
label: "Code calling stored routines"
given: "Java calling a package's procedure through {call …} and a PL/SQL block, a MyBatis mapper's CALLABLE statement, SimpleJdbcCall in a catalog, JPA's @Procedure, ADO.NET and Dapper commands of CommandType.StoredProcedure, a VB6 command of adCmdStoredProc, and Python's callproc, beside the package's spec"
then: "each call names its routine and how it is made, the Java unit's call reaches the package's procedure, and the routines no script creates are known from the calls"
when: "Assay reads and links them"
---
