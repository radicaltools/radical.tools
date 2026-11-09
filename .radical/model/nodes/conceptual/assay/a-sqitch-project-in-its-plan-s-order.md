---
id: "40a52f98-bcbe-4c56-a146-f720fd799bff"
type: "scenario"
label: "A Sqitch project in its plan's order"
given: "a Sqitch project whose plan creates a table and then drops a column and adds one, a script of procedures followed by a REVOKE, a trigger function clearing a flag with := 'f' under a comment that sets it, a reworked and a revert script, beside a SvelteKit app and a compose backup job running postgres's image"
then: "the table ends with the added column citing its script, tic_close writes player and calls nothing, the flag is set and cleared on the right lines, the app's routes are read, a code host's path is none, and the backup job is no database"
when: "Assay reads them"
---
