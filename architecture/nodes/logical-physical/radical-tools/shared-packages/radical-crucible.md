---
id: "cdefa455-5e6f-4395-8261-f61398610d02"
type: "component"
label: "@radical/crucible"
technology: "TypeScript, fast-check"
---

packages/crucible: Radical Crucible's engine. runWorld runs one world of a fuzz suite with fast-check (a plan's seed, runs and longest sequence, or a path to replay; shrinking; survey mode that reports each new signature once and goes on), steps through the suite's start, step and end, and turns a RuleBroken into a failure naming the rule, the steps as resolved and what differs, unless a known entry matches (rule, last action, earlier actions, difference paths, facts, or its own matcher). differences compares two values within a tolerance; signatures are the rule, the last action and the shape of what differs with ids taken out; fuzzOptionsFromEnv reads the FUZZ_* settings; mulberry32 and sequentialIds make runs replay. ./vitest registers a suite as a case per world and one per world and rule, and a case per hardened or fixed finding of the file (regressions), which replays the finding's sequence once without the known failures (replay); findings.ts parses findings and loads the folder for a fuzz file, ./findings (findingFiles.ts) reads and writes crucible/findings/F-NNNN.md for the CLI. Used by @radical/ui's store fuzz test and bundled into the CLI.
