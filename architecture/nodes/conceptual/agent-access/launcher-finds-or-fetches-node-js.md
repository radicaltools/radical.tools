---
id: "2aca2a24-370d-40e6-8866-82577aaf712e"
type: "requirement"
label: "Launcher finds or fetches Node.js"
action: "the launcher shall run the CLI of the version it names (latest until radical setup pins one; RADICAL_VERSION for one run) through npx, with a Node.js 20.11 or later that has npx beside it, found on the PATH or under ~/.radical/node; where there is none, download the latest Node.js 24 build for the platform from nodejs.org into ~/.radical/node after asking in a terminal (or with --yes), checked against its SHA-256 sum before it is unpacked; and run mcp as the MCP server of that version, never asking and never downloading"
ears_type: "event-driven"
rationale: "Someone starting a model may have no Node.js, and an agent starts the server with no terminal to ask in. A script fetched into an empty folder takes one command to a connected agent on macOS, Linux and Windows, and the steps stay in radical setup. Evidence: apps/cli/launcher/radical.sh, apps/cli/launcher/radical.cmd"
trigger: "radical.sh or radical.cmd runs with a radical command"
---
