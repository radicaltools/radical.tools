---
id: "f8f39da7-e8a2-41d1-9ab5-d6e6e14a39d7"
type: "scenario"
label: "Link behind a login refused"
given: "a link that answers 401 and one that redirects to a sign-in page"
then: "nothing of either is kept, and each answer names the export to give instead"
when: "each is given as a source"
---
