---
id: "253c2a5c-8098-4931-8f89-09eb9a6d848b"
type: "scenario"
label: "A short start and the procedure apart"
given: "three repositories of 60 units and 200 links"
then: "assay_start answers in under 20 KB with the links counted by kind, assay_procedure gives the steps, and the links come in pages of at most 20 KB with where the next starts"
when: "an agent calls assay_start, then assay_procedure, then assay_facts for the links"
---
