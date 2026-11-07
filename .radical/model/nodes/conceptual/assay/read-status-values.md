---
id: "f9849f6b-fbfa-43db-8788-b17254622fd4"
type: "requirement"
label: "Read status values"
action: "the system shall record them as a state fact of that unit, with the table and column they belong to where the SQL says so, and the lines of the unit's code that set each value"
ears_type: "event-driven"
rationale: "A lifecycle is the values a status takes and the code that moves it from one to the next."
trigger: "a unit's code or SQL declares the values a status or state can take: an enum named for a status or state, a CHECK … IN list or a MySQL ENUM on such a column, a PostgreSQL enum type, a TypeScript union of strings"
---
