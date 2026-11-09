---
id: "ed378400-884f-4337-9967-5458042d9fb2"
type: "scenario"
label: "A host a Spring placeholder defaults to"
given: "a Java client whose constructor takes @Value(\"${catalog.service.host:catalog}\") and the port beside it, in a repository with a catalog unit"
then: "the client unit calls the catalog unit, the address cited on its line"
when: "Assay reads it"
---
