---
id: "81df6d10-1239-4975-b8c0-ebac67788c6e"
type: "scenario"
label: "Private address refused"
given: "a link to a loopback address, and a link that redirects to 169.254.169.254"
then: "nothing is fetched from either address, and each answer names it"
when: "each is given as a source"
---
