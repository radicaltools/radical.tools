---
id: "41b7e847-50ed-4740-b7fc-1c3d9b5ec267"
type: "scenario"
label: "A process written in the Warnier view"
given: "the Checkout process in a view of the viewpoint Process (Warnier)"
metrics: |
  test(apps/e2e/tests/studio/warnier.spec.ts › a process is written in the Warnier view from the keyboard) passed
  test(apps/e2e/tests/studio/warnier.spec.ts › an element added after another stays after it, whatever its name) passed
  test(apps/e2e/tests/studio/warnier.spec.ts › a process is built by clicking where it is drawn, from an empty Warnier view) passed
  test(apps/e2e/tests/studio/warnier.spec.ts › in a view of one process, what is added or moved stays in that process) passed
  test(apps/e2e/tests/studio/warnier.spec.ts › in a milestone, the name of the first element added stays open through the question how to save it) passed
  test(apps/e2e/tests/studio/warnier.spec.ts › + Process in a view filtered to inside an element adds the process there) passed
  test(packages/ui/tests/reparentOnEveryCanvas.test.ts › a step indented in the Warnier view) passed
  test(packages/ui/tests/reparentOnEveryCanvas.test.ts › a step outdented in the Warnier view) passed
then: "Check stock is a step after Take the order, then inside it with (1,n), Pay moves before Reserve stock and every sibling list reads 1, 2, 3 in its order field; Check stock outdents after Take the order; one undo puts it back inside; an indented or outdented step lies inside its new parent on every canvas; a view of one process offers no + Process and nothing leaves the process; + Process in a view filtered to inside an element adds the process inside that element, numbered among that element's processes; in a milestone the new element's name stays open through the save question"
when: "the user selects Take the order, presses Enter and types Check stock, presses Tab, sets Repeat 1..n, presses Alt+Up on Pay, presses Shift+Tab on Check stock, then undoes once"
---
