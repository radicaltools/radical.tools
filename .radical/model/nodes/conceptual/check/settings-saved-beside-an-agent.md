---
id: "fa6cd96a-5c6b-4b55-86cd-e47e6ac2649c"
type: "scenario"
label: "Settings saved beside an agent"
given: "a folder model open in the Inspector's Settings, and an agent that binds a test in .radical/radical.json and changes check.json after Settings read them"
then: "check.json holds the agent's change and the user's, radical.json keeps the agent's binding, and a file Settings did not change is not written"
when: "the user changes a rule in Settings and saves"
---
