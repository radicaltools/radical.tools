---
id: "c12c9c2f-3365-4102-810c-19e7f18e069e"
type: "scenario"
label: "Search wiki pages"
given: "the sample's Architecture Wiki"
then: "Auth Service is the only match, with a snippet of its description; Enter opens its page; the list then says nothing matches; a word is found as the page shows it, not in a link's address or a Markdown mark"
when: "the user types jwt in Search pages and presses Enter, then types text no page holds"
---
