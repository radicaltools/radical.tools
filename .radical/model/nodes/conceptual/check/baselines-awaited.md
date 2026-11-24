---
id: "782f4aba-7ce3-4541-8571-58e043829569"
type: "scenario"
label: "Baselines awaited"
given: "a check.json that waits for its baselines"
then: "the first reports an error that says to run radical check --adopt; the second sets each rule's max to its count and each goal to its share, and the next check passes"
when: "radical check runs, then radical check --adopt"
---
