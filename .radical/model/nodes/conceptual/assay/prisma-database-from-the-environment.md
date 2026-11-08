---
id: "65ec6ff5-61f8-4731-bff3-4fd318d93235"
type: "scenario"
label: "Prisma database from the environment"
given: "a Node application whose Prisma schema's datasource has provider postgresql and url env(\"DATABASE_URL\")"
then: "the application uses a PostgreSQL database with no name"
when: "Assay reads it"
---
