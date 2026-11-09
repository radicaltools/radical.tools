---
id: "73fe0c42-71cf-4fdd-a2cb-294cc4082ebb"
type: "scenario"
label: "A Django foreign key broken over lines"
given: "a Django model whose ForeignKey calls break after their parenthesis, one to a model class and one to \"breads.BreadType\" given as a string"
then: "each foreign key references its target model's table, breads_country and breads_breadtype"
when: "Assay reads it"
---
