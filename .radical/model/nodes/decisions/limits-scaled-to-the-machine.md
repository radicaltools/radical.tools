---
id: "57da9569-ea1f-4f0f-bdb9-db525bbaa631"
type: "adr"
label: "Limits scaled to the machine"
alternatives: |
  1. Scale every time limit when a machine speed is measured: simpler to write, but it would stretch what the machine does not cause, such as the LCP of real users or a production latency.
  2. Normalise the values when they are measured: the conditions stay as they are, but the raw value is lost and nobody sees what was measured.
  3. Fixed limits with a margin wide enough for the slowest runner: no tooling, but a regression on the fast machine passes unseen.
  4. Lighthouse's benchmarkIndex as the speed: only for browser audits, and on a scale of its own.
consequences: |
  • A limit set on a fast laptop holds on a slow runner without a margin that hides regressions on the fast one.
  • The model still says the limit as it was set, and the check shows how it was stretched.
  • A faster machine never tightens a limit (×1 at least), so a pull request is not failed by a fast runner.
  • The built-in work measures the CPU and the JavaScript engine; a project whose limits depend on disk or network names its own work with --work.
  • One more sensor run in CI, a few seconds, twice.
context: "IsoStride's unit tests must each run in under 100 ms on its author's Mac; on GitHub's shared runner the same tests took three to five times as long, so a fixed limit blocked merges now and then for no real cause. The project wrote a script that timed a fixed piece of work before and after the tests, compared it with the same work on the reference machine and multiplied the limit by the factor. Every project with a time limit in CI meets the same problem, and the script lived outside the model, which still said 100 ms."
date: "2026-11-24"
decision: "Radical measures the speed of the machine with a sensor, `radical sense machine`: it times a fixed piece of work built into the CLI (or a command given with --work) after a warm-up, takes the median, and measures machine.work (ms) and machine.speed, the ratio to the reference time. The reference is measured once with --reference on the machine the limits were set on and kept in the repository's .radical/radical.json, in git. Run before and after the tests with --again, the slower of the two stands, as a shared runner's speed changes while it works. A condition opts in with the word scaled at its end (`test.duration.max{kind=unit} <= 100 ms scaled`): the engine multiplies an upper limit, or divides a lower one, by the machine.speed measured nearest in time to the value, never below ×1, and shows the arithmetic (\"100 ms × 2.4 = 240 ms\"). Measurements are kept raw. A scaled condition with no machine.speed is not measured."
status: "accepted"
---
