---
id: "41b7e847-50ed-4740-b7fc-1c3d9b5ec267"
type: "scenario"
label: "A process written in the Warnier view"
given: "the Checkout process in a view of the viewpoint Process (Warnier)"
tests: "apps/e2e/tests/studio/warnier.spec.ts › a process is written in the Warnier view from the keyboard"
then: "Check stock is a step after Take the order, then inside it with (1,n), Pay moves before Reserve stock and every sibling list reads 1, 2, 3 in its order field; Check stock outdents after Take the order; one undo puts it back inside"
when: "the user selects Take the order, presses Enter and types Check stock, presses Tab, sets Repeat 1..n, presses Alt+Up on Pay, presses Shift+Tab on Check stock, then undoes once"
---
