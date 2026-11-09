---
id: "6e044ae9-1a72-4031-a1b6-f8537cafc305"
type: "scenario"
label: "Oracle's connections"
given: "a Spring service's JDBC thin URLs by service and by SID, a .NET app's ODP.NET Data Source holding a TNS descriptor, and a Python app's oracledb dsn host:port/service and cx_Oracle.makedsn"
then: "each names an Oracle database with its server and name"
when: "Assay reads them"
---
