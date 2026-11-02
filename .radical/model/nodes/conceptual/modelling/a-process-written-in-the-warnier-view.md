---
id: "41b7e847-50ed-4740-b7fc-1c3d9b5ec267"
type: "scenario"
label: "A process written in the Warnier view"
given: "the Checkout process in a view of the viewpoint Process (Warnier)"
then: "Check stock is a step after Take the order, then inside it with (1,n), Pay moves before Reserve stock and every sibling list reads 1, 2, 3 in its order field; Check stock outdents after Take the order; one undo puts it back inside; an indented or outdented step lies inside its new parent on every canvas; a view of one process offers no + Process and nothing leaves the process; + Process in a view filtered to inside an element adds the process inside that element, numbered among that element's processes; in a milestone the new element's name stays open through the save question"
when: "the user selects Take the order, presses Enter and types Check stock, presses Tab, sets Repeat 1..n, presses Alt+Up on Pay, presses Shift+Tab on Check stock, then undoes once"
---
