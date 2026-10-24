---
id: "aaeced7c-81fd-43bf-bb98-c5cdf9e65ac4"
type: "scenario"
label: "Cut short, nothing worse"
given: "a large view whose budget runs out right after the sketch"
tests: |
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a large view or a pile gets a rough layout first
  packages/layout/tests/tidy/craft.test.ts › Tidy, the finer points › a time budget stops the tidying with what was done
then: "the result costs no more than the canvas it started from"
when: "Smart Layout hands over its result"
---
