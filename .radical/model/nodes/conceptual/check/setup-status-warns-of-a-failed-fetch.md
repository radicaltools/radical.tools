---
id: "2071d95e-73e5-4d05-9cc7-eaea6ddd9656"
type: "scenario"
label: "Setup status warns of a failed fetch"
given: "a repository set up for Radical whose model folder records a fetch from CI that found no test report"
then: "it prints a warning with when the last fetch ran and what it said, and what CI has to keep as artifacts; with a fetch that read results it prints the run and the commit"
when: "radical setup --status runs"
---
