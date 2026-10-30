---
id: "4077df69-bd3d-4758-b042-0c7a697c58d4"
type: "scenario"
label: "Round prepared"
given: "a git repository with crucible.json naming a build, a folder to copy, a server and a brief, a last round of runs 3 and 4 at an earlier commit, a model with an element changed since, and an open finding"
metrics: |
  test(apps/cli/src/explore.test.ts › radical explore prepare › builds once and gives each run its folder, copy, ports and prompt) passed
  test(apps/cli/src/explore.test.ts › radical explore prepare › writes a brief of what changed since the last round, in the code and the model) passed
  test(apps/cli/src/explore.test.ts › radical explore prepare › exits 2 without explore settings) passed
then: "runs 5 and 6 get their folders with a copy of the build, ports 4505 and 4506, prompts naming their areas; the brief names the commit, the commits and model elements changed since the last round, the open finding and the report's form; the journal lists both runs; the second exits 2"
when: "radical explore prepare --runs 2 --areas \"layout;undo\" runs, and again without crucible.json's explore settings"
---
