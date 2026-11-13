---
id: "2094b496-032d-4923-860a-60fb07e50a08"
type: "adr"
label: "Benchmark in the monorepo, runs off git"
alternatives: "Keep the separate repository (two places to change together, and it existed on one disk only). Import its history with the result reports cut out (git filter-repo; more work for a short history). tools/bench (not a workspace, so not checked like one)."
consequences: "A change to radical.tools and a benchmark run of it can share a branch, and the harness runs the checkout's build with --radical-local ../... The hidden details and tests of the system under test become public once the branch is pushed: a model trained later may have read them, so a published benchmark needs new hidden details. apps/bench is not a deployable, unlike the other apps (ADR Monorepo with npm workspaces)."
context: "The Radical benchmark (with and without Radical, a simulated product owner, hidden tests) lived in a repository of its own on one disk. It measures radical.tools and its changes, and it ran the monorepo's own build through --radical-local; its runs hold transcripts, the product owner's answers and scores that are not to be published."
date: "2026-11-13"
decision: "The benchmark lives in the monorepo as apps/bench, a private npm workspace that is never published and that CI does not run (a run costs money and hours). It came over as one commit, without the separate repository's history. The results of runs (runs/, results/) stay on the disk that ran them and never go into git; work folders and the group standards model stay outside the repository (BENCH_WORK, BENCH_STANDARDS, beside the checkout by default)."
status: "accepted"
---
