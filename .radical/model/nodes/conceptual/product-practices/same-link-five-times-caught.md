---
id: "22e16636-c9b7-4f3d-a996-b27e5bebcad8"
type: "scenario"
label: "Same link five times caught"
given: "a page whose main content links to the same page in 5 places"
then: "it measures ux.links.repeated.max = 5 and fails, since the limit is 2"
when: "the repeated-links test runs"
---
