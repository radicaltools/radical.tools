---
id: "b56a7817-120d-4c59-9866-c6469c18cbd5"
type: "scenario"
label: "A relation goes by how it reads"
given: "the bookstore's System Context, and the Radical metamodel's relation types"
metrics: |
  test(packages/common/tests/prose.test.ts › relationTypeName › names a type by how it reads from its source, its name else, the id for one the metamodel lacks) passed
  test(packages/common/tests/prose.test.ts › relationTypeName › reads a pair the metamodel gives its own reading by it, in sentences too) passed
  test(apps/e2e/tests/studio/editing.spec.ts › a relation with no label shows how its type reads, as its card names it) passed
then: "the line reads \"delivers to\" and the card's Type reads Delivers to; the engine names Interacts \"Uses\" between systems and \"Delivers to\" to a person, \"Receives from\" back, Partnership \"Partners with\", Part of \"Part of\", a type it does not have by its id, and in lower case on asking; a person's page reads \"Uses\" for the systems it uses and \"Receives from\" for those that deliver to it"
when: "the user connects Payment Provider to Customer, which makes an Interacts relation with no label, and double-clicks it; and the engine names the types for their pairs and the sentences of a person's relations"
---
