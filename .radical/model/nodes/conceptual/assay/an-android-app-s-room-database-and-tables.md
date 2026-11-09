---
id: "0499cfe9-82eb-475c-8f99-b0ce618f88c7"
type: "scenario"
label: "An Android app's Room database and tables"
given: "a Kotlin module building a Room database named news-database, with an entity naming its table and a cross reference whose foreign key names the entity of another table"
then: "the module uses the SQLite database news-database, whose tables are those the entities name, the cross reference referencing the topics table"
when: "Assay reads it"
---
