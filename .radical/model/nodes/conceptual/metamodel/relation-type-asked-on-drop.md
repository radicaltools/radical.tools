---
id: "e3c635b4-8735-4278-a4df-769824e40127"
type: "scenario"
label: "Relation type asked on drop"
given: "two entities, between which part-of and references both fit, two aggregate roots, a metamodel with a relation type that has no pairs, and a relation without a type between a pair the metamodel has several types for"
then: "the relation chosen is added, the dismissed one is not; between aggregate roots part-of is not offered and references is it; where only the any-pair type fits the relation gets it, where it fits beside another Studio asks, and so does the matrix cell; Validation warns about the untyped relation, an any-pair type counting as one that fits"
when: "the user draws a relation between the entities and picks a type, draws another and dismisses the question, draws one between the aggregate roots, draws relations where only the any-pair type fits and where it fits beside another, clicks an empty matrix cell where several types fit, and the model is validated"
---
