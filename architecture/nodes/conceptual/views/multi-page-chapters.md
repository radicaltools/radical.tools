---
id: "cf1b7c22-040a-4752-92fa-d8564789ab49"
type: "scenario"
label: "Multi page chapters"
given: "the Core Banking Platform wiki page in Designer"
tests: "apps/e2e/tests/studio/wiki.spec.ts › wiki › Multi page writes the children as chapters, and a group by its own name"
then: "its children are chapters listed in Contents, a group is a chapter under its own name with no Groups heading, containers are named under their type with what it is, and a chapter's Open button opens its page"
when: "the user switches to Multi page"
---
