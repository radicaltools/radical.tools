---
id: "e61d543b-8618-41ea-8bdf-f7797a06d73c"
type: "fitness-fn"
label: "Benchmark runs off git"
cadence: "triggered"
characteristic: "security"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

apps/bench/tests/layout.test.ts asks git which of the benchmark's files it ignores: the results of runs, and none of the harness or the system under test.
