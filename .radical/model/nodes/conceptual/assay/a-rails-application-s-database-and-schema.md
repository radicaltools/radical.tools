---
id: "1e72df5a-bf92-4c57-a78c-b519bc849f0d"
type: "scenario"
label: "A Rails application's database and schema"
given: "a Rails application whose database.yml takes its production database's name from ENV.fetch with a default, a CI workflow starting a PostgreSQL for its tests, a db/schema.rb of two tables and a foreign key, and a migration whose SQL names a dropped table"
then: "its database is the production one at the default host, not the CI job's; its tables are those of the schema, with their columns and the foreign key, and not the dropped one"
when: "Assay reads it"
---
