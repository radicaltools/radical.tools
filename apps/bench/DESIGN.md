# radical.bench — design

Status: draft for the pilot. Nothing is frozen yet.

## Question

Does building and then changing a system with radical.tools (Radical Forge,
then model-first changes) give a better result than the same LLM agent working
without it, and at what cost?

Hypotheses, stated before any run:

- H1. After the build step (step 0) the arms differ little in correctness;
  the Radical arm costs more.
- H2. Over the change steps the Radical arm keeps more earlier behaviour
  working (fewer regressions) and breaks fewer architecture rules.
- H3. The Radical arm notices a request that conflicts with an earlier
  decision more often.
- H4. The plain-documents arm lands between the other two. If it matches the
  Radical arm, the value is in the discipline, not in the tool.
- H5. The difference between the arms is smaller on the stronger model.

## Arms

Same harness, same turn and token limits, same access to the product owner.
Every arm runs on two models, Sonnet 5.5 (`claude-sonnet-5-5`) and Opus 5.5
(`claude-opus-5-5`); arms are compared within one model, never across. The
second model shows whether the difference between arms shrinks as the model
gets stronger. The product owner runs on one pinned model for all runs.

| Arm | The agent gets |
|---|---|
| A. bare | the brief and the repository |
| B. docs | A, plus an instruction to keep `ARCHITECTURE.md`, ADRs and a requirements file in Markdown and to update them before the code |
| C. radical | A, plus the Radical MCP server: Forge at step 0, then model-first changes (`get_changes`), with `radical check` run before the step is reported done |

## System under construction

A shop with a warehouse: catalogue, stock, reservations, orders, payments
(fake provider), shipments. TypeScript, HTTP API, SQLite, no UI in the pilot.

The brief fixes the external contract (OpenAPI: paths, payloads, status
codes) so one hidden test suite fits every arm. It states a few architecture
rules that later steps put under pressure, for example:

- R1. Stock changes only by appending a stock movement; no direct update.
- R2. Available stock is never negative.
- R3. Only the payments module talks to the payment provider.
- R4. Modules call each other through their public interface, not their tables.

The brief is incomplete on purpose (see Product owner).

## Steps

Each step is one headless agent session with no memory of earlier sessions.
What the agent knows about the system is what is in the repository.

| # | Kind | Request |
|---|---|---|
| 0 | build | Build the system from the brief |
| 1 | feature | Cancel an order; reservations are released |
| 2 | cross-cutting | Several warehouses: stock and reservations per warehouse |
| 3 | behaviour change | An unpaid reservation expires after 15 minutes |
| 4 | trap | "Let support correct stock straight from the order screen" (pressure on R1) |
| 5 | feature | Returns and partial refunds, returned goods restocked |
| 6 | cross-cutting | Discount codes: order totals, payments, refunds |
| 7 | refactor | Second payment provider behind one interface; behaviour unchanged |
| 8 | trap | "Allow ordering items that are out of stock" (pressure on R2) |

For a trap the accepted outcomes are: the request met without breaking the
rule, or the conflict reported and left for a decision. Breaking the rule
silently is the failure.

## Product owner

A separate LLM session holding the full hidden specification. Any arm may
ask it questions through one tool, `ask_product_owner(question)`.

Rules that keep it from favouring an arm:

- one fixed prompt and model for all arms, pinned in the benchmark version;
- it answers only what was asked, from the specification; when the
  specification is silent it says so and the agent decides;
- it never sees which arm is asking, the repository, or the tests;
- every question and answer is logged; questions per step are capped (same
  cap for all arms);
- questions asked and hidden details recovered are reported as metrics, so
  the effect of asking is visible separately from the effect of modelling.

In arm C the agent passes Forge's clarifying questions and refinement
approvals to the product owner. Arms A and B may ask whenever they like.

## Measurement

All deterministic; no LLM judges the result.

- Correctness: share of hidden acceptance tests of the current step passed.
- Regressions: tests of earlier steps that passed before and fail now.
- Architecture rules: one script per rule (R1–R4), run after every step.
- Traps: rule kept / conflict reported / rule broken.
- Hidden details recovered: tests that depend on facts only the product
  owner knows.
- Cost: input and output tokens, wall time, turns, product-owner questions.
- Change size: files and lines touched per step.

Headline chart: cumulative quality and cumulative cost by step, per arm,
median with spread.

## Harness

```
bench/
  systems/shop/        brief.md, openapi.yaml, hidden-spec.md, steps/NN.md
  systems/shop/tests/  hidden acceptance tests per step (never copied to a run)
  systems/shop/rules/  architecture rule scripts
  arms/                a.md, b.md, c.md: arm instructions; c adds the MCP config
  harness/             run.ts (one run = arm × model × seed), po.ts, score.ts, report.ts
runs/<version>/<model>/<arm>/<seed>/step-NN/   repo snapshot, transcript, usage, scores
```

A run: fresh repository → for each step, start `claude -p` with the arm's
instructions and the step request → snapshot → start the system → run the
hidden tests and rule scripts from outside the working directory → record.
The agent's working directory never contains the tests, the hidden
specification or other runs.

## Rules for a result that holds

- Brief, steps, tests, rule scripts, arm instructions and the product-owner
  prompt are committed and tagged before the first run of a version. A fix to
  any of them is a new version; runs of different versions are not mixed.
- Every run is kept whole: transcripts, usage, repository after each step.
- Failed and aborted runs count and are reported.
- A result against Radical is published like any other.

## Pilot

Scope: one system, three arms, two models, 3 runs per arm and model,
steps 0–8 (162 sessions).

The pilot answers three things, and its numbers are not published:

1. Is there a signal: does any primary metric differ between arms by more
   than it varies inside an arm?
2. Is the system the right size: arm A neither near 100% nor near 0%?
3. What does one run cost in tokens and time?

Then the tasks are corrected, the version is frozen, and the published
benchmark runs with at least 5 runs per arm and 2–3 systems.

## Open

- Turn and token limits per session.
- Whether arm C's instructions are the stock `radical setup` output or
  written for the benchmark (stock is the honest choice).
- A UI step (Forge mockups) in a later version.
