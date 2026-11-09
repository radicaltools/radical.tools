---
id: "da9355a1-a283-447a-87d2-bd11b7c1fb47"
type: "scenario"
label: "Tables SQL in a string creates"
given: "a C# repository class whose CREATE TABLE statements for two tables, one referencing the other, are strings joined with + over lines with a comment between them"
then: "both tables are declared with their columns, each on the line its CREATE TABLE is on, and the reference names the first table"
when: "Assay reads it"
---
