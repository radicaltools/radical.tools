---
id: "ef81bb0a-5cf7-4a59-a2a6-5386cfb9d070"
type: "requirement"
label: "Read the run's files over MCP"
action: "the MCP server shall return the file's lines numbered, or the folder's files listed (hidden ones and what builds make left out), at most 400 at once with where the next page starts, and refuse a file outside the run's repositories and sources"
ears_type: "event-driven"
rationale: "An agent with no file access of its own (Claude Desktop) still reads and cites the code and the documents."
trigger: "an agent calls assay_read with a repository or source of the run, and a file or a folder of it"
---
