---
id: "973c93be-4efe-4cf5-a72b-7f034ac09c24"
type: "scenario"
label: "Machine speed measured"
given: "a repository whose .radical/radical.json holds a reference time"
then: "it measures machine.work and machine.speed, and the second run keeps the slower of the two"
when: "radical sense machine runs, then again with --again"
---
