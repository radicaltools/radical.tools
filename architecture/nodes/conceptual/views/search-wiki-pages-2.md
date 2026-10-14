---
id: "c12c9c2f-3365-4102-810c-19e7f18e069e"
type: "scenario"
label: "Search wiki pages"
given: "the sample's Architecture Wiki"
tests: "apps/e2e/tests/studio/wiki.spec.ts › wiki › search finds a page by what it says and opens it on Enter"
then: "Auth Service is the only match, with a snippet of its description; Enter opens its page; the list then says nothing matches"
when: "the user types jwt in Search pages and presses Enter, then types text no page holds"
---
