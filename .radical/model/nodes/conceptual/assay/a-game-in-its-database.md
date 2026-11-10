---
id: "c38c6bb3-b803-4098-b486-b306ced8ab3a"
type: "scenario"
label: "A game in its database"
given: "a Sqitch project whose reworked trigger-destroy_ship@v1.0.sql alone creates the trigger, whose current script replaces its function and sets destroyed in an UPDATE's SET beside a comparison AND S.destroyed='f', a mission's hint holding UPDATE ship SET destroyed = false, and a Svelte page with a list of starter queries, a replay's returned query, a sql attribute, a query its script runs and one an onclick expression runs"
then: "the trigger is read from the reworked script and the function from the current one, writing ship; the flag is set only by the UPDATE; the page calls only current_round and refuel_ship, from its script and its onclick expression, and names no table"
when: "Assay reads the repository"
---
