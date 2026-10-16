---
id: "22e9405a-6888-4535-adb9-9160a4459c7d"
type: "scenario"
label: "Long register scrolls to rows"
given: "a table view of 30 needs with 10 requirements refined from each"
tests: "apps/e2e/tests/studio/table-large.spec.ts › a long table draws the lines in sight, scrolls to the end, and to a row chosen elsewhere"
then: "fewer than 150 of the 330 rows are drawn while the scrolled height stands for all of them; at the end the last requirement shows and the first need is not drawn; the new need's row is in sight; the picked requirement's row is scrolled into sight"
when: "the user opens it, scrolls to the end, adds a need with its wizard, and picks a requirement near the top in the Structure panel"
---
