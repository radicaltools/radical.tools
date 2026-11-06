---
id: "918d3c30-0f72-428f-aaac-609e1aa0d4a3"
type: "requirement"
label: "Read a repository's facts"
action: "the system shall read the repository's units, their dependencies, APIs, services, addresses, databases and documents, and the tests its test reports name, each fact with its file and line, write them to the repository's .radical/assay/facts.json and change nothing in any model"
ears_type: "event-driven"
rationale: "Facts are what Assay may claim without asking; read the same way every time, they can be tested and compared run to run (ADR Radical Assay)."
trigger: "radical assay extract runs on a directory, or an agent starts an Assay run on it over MCP"
---
