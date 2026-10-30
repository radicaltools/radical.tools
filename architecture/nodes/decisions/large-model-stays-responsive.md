---
id: "4c17ae3e-db1b-4f42-9a57-d7a0b81733d9"
type: "fitness-fn"
label: "Large model stays responsive"
category: "operational"
combine: "all"
max_age: "3d"
metrics: |
  studio.open_ms{model=radical-x14} <= 11000 ms
  studio.open_cached_ms{model=radical-x14} <= 7000 ms
  studio.view_switch_ms{model=radical-x14} <= 2000 ms
  studio.search_key_ms{model=radical-x14} <= 600 ms
  studio.card_key_ms{model=radical-x14} <= 1000 ms
  studio.open_ms{model=radical-x14} <= baseline + 20%
  studio.open_cached_ms{model=radical-x14} <= baseline + 20%
  studio.view_switch_ms{model=radical-x14} <= baseline + 25%
  studio.search_key_ms{model=radical-x14} <= baseline + 25%
  studio.card_key_ms{model=radical-x14} <= baseline + 25%
---

Measured every night (.github/workflows/nightly.yml): apps/e2e/tests/studio/scale.spec.ts drives Studio's web build on radical.tools' own model repeated 14 times (21,000 elements, 40,000 relations) and writes metrics.json; radical sense json reads it with the label model=radical-x14. open_ms: from Open folder until the views are listed and the main thread is quiet; open_cached_ms: the same, opened again from the folder's cache; view_switch_ms: the slowest of nine views of every kind to open; search_key_ms and card_key_ms: the longest a letter typed in Quick Search, and in the card of an element beside a table of 16,000 rows, took to show (Event Timing, as INP measures it). A condition that fails, or that the night measured nothing for, becomes a finding in crucible/findings/ (tools/nightly-findings.ts). The limits are about twice what a developer's machine measures, to be tightened once the nights show what CI measures.
