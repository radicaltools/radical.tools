---
id: "8a328a02-e902-4bfc-bc53-46497454c108"
type: "scenario"
label: "Table structure read"
given: "an SQL file creating customers and orders, orders with a foreign key to customers, an ALTER TABLE adding a foreign key, and a JPA entity with a @ManyToOne field"
then: "each table fact lists its columns and the table each foreign key references, with their lines, and the JPA entity is a table fact of its own"
when: "Assay reads the repository"
---
