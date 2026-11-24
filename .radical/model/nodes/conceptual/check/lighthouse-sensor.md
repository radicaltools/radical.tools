---
id: "e40075e8-83db-4645-9ff3-e754d236102e"
type: "requirement"
label: "Lighthouse sensor"
action: "it shall measure from Lighthouse or Lighthouse CI JSON reports, for each page and form factor (mobile or desktop), the median over the runs of LCP, FCP, CLS, TBT, Speed Index, the bytes loaded and each category's score, and judge no value"
ears_type: "event-driven"
rationale: "Lighthouse asserts its budgets itself, so the limit lived in lighthouserc and not in the model. Read as measurements, the vitals are judged by the model's conditions. ADR Sensors measure, the model decides."
trigger: "the lighthouse sensor reads Lighthouse reports"
---
