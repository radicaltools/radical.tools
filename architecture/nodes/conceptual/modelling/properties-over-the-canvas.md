---
id: "6c58d95a-6415-4882-a71f-647b64fff7c7"
type: "need"
label: "Properties over the canvas"
kind: "stakeholder-note"
source: "Product owner, 2026-10-16"
---

"I want to change the approach to the right menu: it should slide over the screen, not move the centre. Only the node's attributes should appear in it; the list of nodes is no longer needed because it is redundant." Then: "Also redesign this panel: I want it to be comfortable for viewing and editing attributes", and "add a button to start the wizard". In the table: "a click on a row opens the attributes on the right; only a double-click on the name opens inline editing", "remove the buttons for opening the attributes and the wizard from the table". In the wiki: "there is no panel on the right any more: it can stretch over the free space, the index can be wider too". "When I leave a view I want the selection to be cleared; now it is remembered." "Work on the look of the left menu, it looks poor", "add some colour to that menu?". "Put the menu with the elements on the canvas on the left side", "in Designer it is to be visible all the time", "I want one column", "remove the shadow, I have it nowhere else, I want one consistent style across Studio". "Remove Structure view as the default view, the user can make one himself if he wants… instead I want a default view: a table with all elements." "When a new view is created, change the default view type to table." All in one PR.
Settled: an inspector card (name left, value right, edited in place), every attribute shown with empty ones as "—", relations get their attributes there too, sequences move to the left panel, ✕ hides the card until the next selection, a polished accordion with colours on the left, the palette as a vertical bar down the canvas's left side, and All elements kept as the first view but shown as a table.
Translated from Polish.
