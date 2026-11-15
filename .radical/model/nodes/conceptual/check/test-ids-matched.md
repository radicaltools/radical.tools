---
id: "6cefb957-2968-42d8-8375-acf47f1a5a79"
type: "scenario"
label: "Test ids matched"
given: "test ids written one per line, with a comment and a blank line, and test cases from several reports, and ids written as Playwright and Vitest print them, with a project before the file and a line after it"
then: "comments and blank lines are skipped; an id finds tests by a path suffix either way and the end of the title path, a describe block finds its tests, a line without a title finds the whole file or directory, and an id elsewhere finds none; an id with a project and a line finds the same test as without them"
when: "they are matched to the test cases"
---
