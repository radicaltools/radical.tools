---
id: "18ca3ee3-9596-43f4-b02b-e7297c59f5d6"
type: "scenario"
label: "Finding replayed"
given: "an open finding of the fuzz file, world bookstore, with its seed, path and length"
tests: |
  apps/cli/src/fuzz.test.ts › radical fuzz › replays a finding with its world, seed, path and length
  packages/crucible/tests/engine.test.ts › runWorld › replays a counterexample from its seed and path
then: "the fuzz file runs once with that world, seed, path and length and no shrinking; an unknown id exits 2"
when: "radical fuzz --replay runs with its id, and with an id no finding has"
---
