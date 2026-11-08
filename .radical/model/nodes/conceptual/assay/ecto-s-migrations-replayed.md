---
id: "e5e1c626-d0f8-4556-b979-37f82b325afb"
type: "scenario"
label: "Ecto's migrations replayed"
given: "an Elixir application whose migrations create, rename and drop tables, run Oban's migrations, execute a CREATE TABLE with its DROP as the second statement, and load SQL by name from a .sql.eex file, beside a structure.sql of an older time, and whose runtime configuration names a ClickHouse URL on port 8123"
then: "its tables are those the last migration leaves (the renamed one by its new name, Oban's, the executed and the loaded ones), not the dump's, and its ClickHouse database is named"
when: "Assay reads it"
---
