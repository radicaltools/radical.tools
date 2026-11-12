---
id: "7ae02607-fa47-460a-85cc-81ba7e9218ca"
type: "scenario"
label: "Agent told to keep answers and review"
given: "the MCP server started on a model folder"
then: "the rules tell it to add each question and answer word for word to the need, and the instructions tell it to call review_requirements before it writes code"
when: "an agent reads its instructions and get_model_summary's modelling rules"
---
