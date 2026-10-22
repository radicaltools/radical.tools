---
id: "9991fb44-61a0-432d-9a13-ba54cbd69dc8"
type: "scenario"
label: "Browse category and search"
given: "the Hub landing page is open"
tests: "apps/e2e/tests/hub/hub.spec.ts › browse a category and search"
then: "only the Data packs are listed with the link #/cat/data, Authentication is not, and the search shows Backup and recovery but not Personal data"
when: "the user clicks the Data group and then searches for backup"
---
