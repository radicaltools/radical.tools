---
id: "8e473fdb-27e7-434b-b89a-165b13f5ef20"
type: "scenario"
label: "Setup pins the launcher"
given: "a folder outside git that holds radical.sh, and radical setup run through it"
metrics: "test(apps/cli/src/setup.test.ts › radical setup › through the launcher, pins it and starts each agent's server through it, in a git repository it starts) passed"
then: "the launcher is pinned to the CLI's version and executable; .mcp.json runs sh radical.sh mcp --folder architecture, Claude Desktop sh with the launcher's and the folder's absolute paths and node's directory on PATH; a git repository is started and its hooks save the base through sh radical.sh; radical setup --status finds both entries for the folder with the launcher's version"
when: "radical setup runs in a terminal for Claude Code and Claude Desktop, answering yes to start a git repository"
---
