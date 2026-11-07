---
id: "bd1f05f4-4e73-406b-ac82-a506fb1c5152"
type: "scenario"
label: "Database named by its driver"
given: "a VB6 module building \"DRIVER={MySQL ODBC 8.0 ANSI Driver};SERVER=\" & host, an SQL file creating two tables, and a form whose data control has RecordSource = \"Users\""
then: "the unit has a MySQL database fact, and table facts for the two tables created and for Users"
when: "Assay reads it"
---
