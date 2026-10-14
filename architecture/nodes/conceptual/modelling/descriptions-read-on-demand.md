---
id: "1a558428-a009-4190-ae04-127b413a9ad7"
type: "scenario"
label: "Descriptions read on demand"
given: "a folder model loaded without its element descriptions"
tests: "apps/studio/tests/lazyNodeHydration.test.ts › lazy node body hydration (md-folder docs)"
then: "the element's description is read from its file without an undo step, and the search finds an unopened element whose description matches while the others stay unread"
when: "an element is opened, or the descriptions are searched for a word"
---
