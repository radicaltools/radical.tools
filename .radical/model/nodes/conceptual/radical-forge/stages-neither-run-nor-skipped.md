---
id: "36b017ea-389b-4c73-bf55-a233beb8d9a7"
type: "scenario"
label: "Stages neither run nor skipped"
given: "an agent's Forge run with Mockups and State machines skipped with a reason and Requirements clarified but not completed"
then: "it names Mockups and State machines skipped with the reason and every other stage not run, and the run's status says the same: finished, those two skipped, the others pending, none asking questions"
when: "the agent calls forge_finish"
---
