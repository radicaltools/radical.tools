---
id: "480c4aaf-127f-4142-9995-2c3b63c1df5a"
type: "scenario"
label: "Results ignored by git"
given: "the benchmark in apps/bench, with a run under runs/pilot13 and a report under results/"
then: "it ignores runs/pilot13/po.jsonl and results/pilot3-report.md, and not harness/run.mjs, systems/shop/hidden/00.md or systems/shop/tests/s00.mjs"
when: "git is asked which of its files it ignores"
---
