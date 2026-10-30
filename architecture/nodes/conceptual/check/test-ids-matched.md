---
id: "6cefb957-2968-42d8-8375-acf47f1a5a79"
type: "scenario"
label: "Test ids matched"
given: "test ids written one per line, with a comment and a blank line, and test cases from several reports"
metrics: |
  test(packages/common/tests/checkReports.test.ts › test reports › reads test ids one per line, leaving out comments; a title may hold "; ") passed
  test(packages/common/tests/checkReports.test.ts › test reports › finds a test by a path suffix either way and the end of its title) passed
then: "comments and blank lines are skipped; an id finds tests by a path suffix either way and the end of the title path, a describe block finds its tests, a line without a title finds the whole file or directory, and an id elsewhere finds none"
when: "they are matched to the test cases"
---
