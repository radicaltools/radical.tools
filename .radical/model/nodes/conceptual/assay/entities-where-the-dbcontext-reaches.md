---
id: "c1ff38d8-74dd-4fb6-8c2c-471023f6c07a"
type: "scenario"
label: "Entities where the DbContext reaches"
given: "an Order class in a Core project that an Infrastructure project with the DbContext and DbSet<Order> references, and another Order class in a Web project the DbContext does not reach"
then: "only the Core project's Order is a table, Orders"
when: "Assay reads them"
---
