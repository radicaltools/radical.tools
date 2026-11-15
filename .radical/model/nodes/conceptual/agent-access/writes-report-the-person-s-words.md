---
id: "63d8ef58-ea92-4bea-8609-9cc7e6d140e4"
type: "requirement"
label: "Writes report the person's words"
action: "the MCP server shall add to its answer each finding of the rules about the person's words (a quote the need does not hold, a value lost or given another sense on the way to the requirement or its scenario, an example no scenario holds, an answer no requirement quotes) that the change brings in and check.json does not turn off, a finding the model had before under the names the change gives not counting as brought in (a rename brings in nothing), and still make the change"
ears_type: "event-driven"
rationale: "Prevent rather than detect: the agent hears of a lost value while it writes the requirement, not from CI after the code. A rename was told as bringing in every finding of the renamed element again (F-0127, round 201–210)."
trigger: "an agent changes the model through the MCP server"
---
