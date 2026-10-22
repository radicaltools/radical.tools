---
id: "67072b4e-8c08-43f1-a10b-98fb314dccb5"
type: "component"
label: "Fuzz command"
technology: "Node.js, node:child_process"
---

apps/cli/src/fuzz.ts (radical fuzz): reads crucible.json (the fuzz files, the command and folder each runs in, the findings folder), runs each file through its test runner with the FUZZ_* settings of the plan and options (--world, --seed, --runs, --length, --no-known, --no-shrink, --report for a Vitest JSON report), and with --survey turns the failures the runs record into new finding files; --replay <id> runs a finding again with its seed, path and length.
