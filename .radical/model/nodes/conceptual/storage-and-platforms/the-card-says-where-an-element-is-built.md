---
id: "8bf47a4a-1be5-4ac6-baf5-10bbb112fd46"
type: "scenario"
label: "The card says where an element is built"
given: "a repository whose .radical/radical.json maps a system to . and one of its containers to apps/api, opened in Studio by the repository, and again by its .radical/ folder"
metrics: |
  test(packages/common/tests/repositoryMapping.test.ts › where an element is built › gives the paths an element is built in, where they come from, and the command that maps one) passed
  test(apps/studio/tests/webFolder.test.ts › a repository laid out with .radical/ › reads the repository's mapping through the repository picked) passed
  test(apps/e2e/tests/studio/repository-mapping.spec.ts › the card says where an element is built, for a repository opened) passed
  test(apps/e2e/tests/studio/repository-mapping.spec.ts › the card says where an element is built, for a .radical folder opened) passed
  test(apps/studio/tests/webFolder.test.ts › a repository laid out with .radical/ › opens the model of a .radical folder picked, and reads its mapping) passed
then: "the container's card shows apps/api, the component's apps/api from the container, and the other card the radical implement command for it"
when: "the user opens the cards of the container, of a component inside it and of an element of no system"
---
