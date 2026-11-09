---
id: "01cc9e43-bfee-407e-9a9b-75017aaf56a6"
type: "scenario"
label: "Entity Framework's snapshot, SQLite in code, a package's services"
given: "a .NET app with a DbSet of a keyless result its migrations' snapshot leaves out and UseSqlite(\"Data Source=pets.db\"), and an Oracle package naming a Slack hook, a namespace and a link on a page"
then: "the table is Pets, the database pets.db, and the package's one address hooks.slack.com"
when: "Assay reads them"
---
