---
id: "75e68b27-cb44-450c-ae48-116069a00893"
type: "scenario"
label: "Known failure passes"
given: "a fuzz file whose rule is broken by one kind of step, listed as a known entry, and a second entry no run matches"
then: "the property passes, the first entry's hits are counted, the summary lists the second with no hit, and an entry by last action, earlier actions, difference paths or facts matches only where all it names hold"
when: "the world runs"
---
