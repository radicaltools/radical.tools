---
id: "e271decd-bb64-48aa-89e3-49efb278535d"
type: "scenario"
label: "A dependency on the latest version"
given: "payments' deps.json naming general-architecture at latest, whose repository has tags v1.2.0 and v1.10.0 and a newer commit on main"
then: "the first fetch takes v1.10.0 and says latest → v1.10.0, the second v1.11.0; the commit on main after the tags is not taken; .state/federation.json keeps the pin latest and the version it resolved to"
when: "radical federation fetch runs, a tag v1.11.0 is added, and it runs again"
---
