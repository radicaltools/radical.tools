---
id: "f6bfbeb1-b650-43ae-8105-65bb4c5a451a"
type: "scenario"
label: "Django and Doctrine entities"
given: "a Django app with Wagtail pages, orderables, a model whose class head spans lines and an abstract model, and a Symfony application with Doctrine entities, one naming its table and a many-to-many join table"
then: "each concrete model and entity is a table with its framework's name, and the abstract one is none"
when: "Assay reads them"
---
