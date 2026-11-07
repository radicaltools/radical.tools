---
id: "9e83de94-c016-4816-a1d1-89f26b516e43"
type: "scenario"
label: "Entities written from tables"
given: "an Assay run on a repository whose SQL creates customers and orders with a foreign key, and a container built from its unit"
then: "both entities are written observed in the domain with the references relation; the container, whose code names the orders table, realises Order, and Customer, which only the schema names, is realised by nothing; a reference only the code shows, applied as a relation of the plan, is written inferred with its cardinality"
when: "the agent applies a plan with a domain and the two entities, orders referencing customers"
---
