---
id: "dd815bdb-2ffa-4823-99be-f98a83f7eee0"
type: "scenario"
label: "Paths given to a sensor"
given: "a repository whose .radical/radical.json maps a system to . and one of its containers to apps/api, and an ADR constraining that container and a component of the other container"
metrics: |
  test(packages/node-files/tests/repositoryLayout.test.ts › repository mapping › gives an element its own paths, else its nearest mapped ancestor's) passed
  test(apps/cli/src/sense.test.ts › radical sense run › gives a repository's sensor the element's paths from .radical/radical.json) passed
then: "the container's --context has element.paths [apps/api], the component the system's [.]"
when: "radical sense run runs the repository's sensor for each element"
---
