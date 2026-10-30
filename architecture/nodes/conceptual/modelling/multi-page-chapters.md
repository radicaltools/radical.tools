---
id: "cf1b7c22-040a-4752-92fa-d8564789ab49"
type: "scenario"
label: "Multi page chapters"
given: "the Core Banking Platform wiki page in Designer; and a wiki of 30 needs with 10 requirements refined from each, in Multi page"
metrics: |
  test(apps/e2e/tests/studio/wiki.spec.ts › wiki › Multi page writes the children as chapters, and a group by its own name) passed
  test(apps/e2e/tests/studio/wiki-large.spec.ts › a long Multi page article draws the chapters scrolled to, at the end and back at the top) passed
then: "its children are chapters listed in Contents, a group is a chapter under its own name with no Groups heading, containers are named under their type with what it is, and a chapter's Open button opens its page; the long article shows its last chapter at the end and its first at the top"
when: "the user switches to Multi page; and, in the long one, scrolls to the end and back to the top"
---
