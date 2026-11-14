# Radical benchmark

Does radical.tools help when an AI agent builds and then changes a system, and
at what cost? The same agent builds a shop back end in step 0 and changes it
over 31 more steps, in three arms: A bare, B with Markdown docs, C with Radical
(the MCP server and `radical check`). A product owner simulated by a model
answers the agent's questions; hidden tests score every step through an adapter
a model writes. `DESIGN.md` has the method, `systems/shop/` the system (brief,
steps, hidden details and tests), `arms/` what each arm is told.

A private workspace: never published, and CI does not run it (a run takes hours
and costs money).

## Run

```sh
cd apps/bench
# one arm, steps 0–15, with this checkout's CLI and MCP server (build them first)
caffeinate -is node harness/run.mjs --arm c --model sonnet --seed 1 --version pilot13 --steps 0-15 --radical-local ../..
node harness/report.mjs --version pilot13
```

Run it under `caffeinate` (macOS): a laptop that sleeps freezes the sessions,
and the harness's step timeout counts the time asleep.

Options of `harness/run.mjs`: `--context`, `--po-memory`, `--standards 1`
(`--standards-ref`), `--ballast`, `--radical-local <checkout>`; see its header.
Work folders go to `BENCH_WORK` (default `../bench-work` beside the checkout);
the group standards model is read from `BENCH_STANDARDS` (default
`../radical.bench.standards`). Each session runs Claude Code headless (`claude
-p`), so `claude` must be installed and signed in.

## Results stay off git

`runs/` (transcripts, the product owner's answers, scores) and `results/`
(reports) are ignored by git (ADR Benchmark in the monorepo, runs off git).
