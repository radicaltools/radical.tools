---
id: "2e6c33eb-ec7f-4584-90e5-d4fd54ea1a2a"
type: "scenario"
label: "Status reports a broken connection"
given: "a model folder without hooks, a Claude Code entry whose server answers, a Codex entry whose command is not there and a Claude Desktop entry pinned to another version"
tests: "apps/cli/src/status.test.ts › radical status"
then: "it reports Node, the model's elements, the missing hooks, the server that answers with its version, the missing command and the other version, and exits 1; with every entry working it exits 0; with --no-start it starts no server; the folder that is not a model is reported broken"
when: "radical status runs for the folder, with --no-start, once every entry works, and for a folder that is not a model"
---
