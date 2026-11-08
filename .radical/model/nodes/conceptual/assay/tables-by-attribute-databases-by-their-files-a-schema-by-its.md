---
id: "f005c482-43ea-4d54-9a13-2be003c91501"
type: "scenario"
label: "Tables by attribute, databases by their files, a schema by its users"
given: "an Entity Framework Core class whose [Table] attribute and another attribute stand over it while its DbSet has another name, a project on SQLite whose settings give Data Source=discountdb, an init.sql in no unit's folder creating the database a service's connection string names, and a VB6 data environment opening a Jet file ending in .dll"
then: "the class's table is the one the attribute names, the SQLite database is discountdb, the init.sql's tables are the service's unit's, and the Access database is the .dll file"
when: "Assay reads them"
---
