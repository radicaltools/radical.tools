---
id: "2b0214cc-1cc0-43eb-a53f-1834bc8266dd"
type: "component"
label: "Assay command"
technology: "Node.js, node:util parseArgs"
---

apps/cli/src/assay.ts (radical assay extract <directory or .zip...> [--report <repository>=<path>]... [--json]): takes the code in the directories with @radical/assay (a directory without a .git stands for the repositories directly inside it, or is a folder of code when it holds none; a .zip file is unpacked into <central repository>/.radical/assay/unpacked/ first, without its .git folders; a folder of code is left as it was, its facts written to <current directory>/.radical/assay/facts/), reads each one's facts, writes them to <repository>/.radical/assay/facts.json, links them across the repositories and prints what it found per repository and the links, or JSON; it writes no model. Sources of documents are taken over MCP only.
