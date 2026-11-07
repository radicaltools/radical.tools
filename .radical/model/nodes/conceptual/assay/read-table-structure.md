---
id: "38273996-3980-485a-bcd3-f68be8d0faf0"
type: "requirement"
label: "Read table structure"
action: "the system shall record the table as a table fact of that unit with its columns and, for each foreign key, the column and the table it references, each with its file and line; an SQL file in no unit's folder is the schema of every unit whose code names one of its tables; an Access file's tables, columns and relationships are those of the units using it (read by the MCP server; the CLI reads no Access file and notes it); a view (CREATE VIEW) and a database's own tables (sys…, information_schema) are no tables"
ears_type: "event-driven"
rationale: "Entities are the tables a system keeps; their foreign keys are the only evidence of how they belong together."
trigger: "a unit's SQL creates or alters a table, its code declares an ORM entity (JPA, Entity Framework Core, Django, SQLAlchemy, TypeORM, Prisma), or the repository holds the Access file (.mdb, .accdb) a unit uses"
---
