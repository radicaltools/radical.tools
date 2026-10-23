---
id: "b7963c11-dd65-4d54-ae79-d6eec3229ec3"
type: "scenario"
label: "Sample covers the metamodel"
given: "the bundled Fintech sample"
tests: |
  apps/studio/tests/fintechSample.test.ts › fintech sample model › holds an element of every node type of the metamodel but Blueprint
  apps/studio/tests/fintechSample.test.ts › fintech sample model › has Hub concern packs bound to its elements, each with its view in Concerns
  apps/studio/tests/fintechSample.test.ts › fintech sample model › keeps every view in a folder
  apps/studio/tests/fintechSample.test.ts › fintech sample model › has a laid-out place for every element of every Structure view
then: "it has an element of every node type but Blueprint, concern ADRs that constrain an element and sit in a view of the folder Concerns, every view in one of the folders Conceptual, Logical, Governance and Concerns, and a place for every element of every Structure view"
when: "its elements and views are read"
---
