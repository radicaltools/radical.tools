---
id: "5148d032-0497-4059-a3fd-051a224c7169"
type: "scenario"
label: "Access file schema read"
given: "a VB6 program opening Shop.mdb, which the repository holds, with tables Customers and Invoices and a relationship from Invoices.CustomerFK to Customers.PK"
then: "both are table facts of the unit, declared by Access, with their columns and the invoice's foreign key to customers"
when: "Assay reads the repository"
---
