---
id: "11089086-6caa-4bd8-b5a4-2f6b58e0b96c"
type: "component"
label: "Harden command"
technology: "Node.js, git"
---

apps/cli/src/harden.ts (radical harden): marks a fuzz finding hardened with the test that replays it and the scenario it proves, printing its test() line for the scenario's Metrics (--scenario); with --gate runs a finding's test or any test (--test "<file> › <name>", through the runner crucible.json gives for its folder, else npx vitest run in the file's package) with the source files changed since the base (--base, default the merge base with origin/main) set back to it, then put back, then several times at once (--runs, default 5). The base's files are copied in and the working tree's copied back from a scratch folder, never stashed.
