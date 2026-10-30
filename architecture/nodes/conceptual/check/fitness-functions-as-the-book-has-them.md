---
id: "222d462b-5153-41c2-b6c8-f31a148e75de"
type: "need"
label: "Fitness functions as the book has them"
kind: "brief"
source: "The user, 2026-10-30"
---

The nightly job hard-codes what it runs: the test, its parameters, how its output maps to metrics and which metrics are the night's. Adding a fitness function to the model does not make the night run anything. A sensor is the executing part and belongs outside the model; what to run and the metrics are properties of the fitness function, not of the sensor. The fitness function has to be corrected after the key attributes of fitness functions:

- Quantifiable and objective: based on measurable metrics (latency, response time, memory usage, security compliance, cyclomatic complexity) rather than opinions.
- Atomic vs holistic: atomic tests one precise context (unit tests, linters, static analysis); holistic evaluates the bigger picture, interactions across components, runtime behaviour (overall latency, security under load).
- Triggered vs continuous: triggered runs on an event (a commit in a pipeline); continuous runs constantly or monitors production.
- Static vs dynamic: a fixed rule or threshold, or one that adapts to a shifting context.
- Automated vs manual: most are automated in the pipeline; some are scheduled manual reviews.
- Thresholds and guardrails: clear bounds or pass/fail limits, so drift shows at once.

Read Building Evolutionary Architectures and propose the new structure of a fitness function.
