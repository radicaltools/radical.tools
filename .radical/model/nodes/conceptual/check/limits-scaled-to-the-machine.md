---
id: "b59c9923-232c-4759-a461-241946413179"
type: "requirement"
label: "Limits scaled to the machine"
action: "radical check and the Inspector shall multiply an upper limit (< or <=) by the machine.speed measured nearest in time to the value, or divide a lower limit (> or >=) by it, never below ×1, judge the raw value against that limit and show it as \"100 ms × 2.4 = 240 ms\"; with no machine.speed measured the condition is not measured"
ears_type: "event-driven"
rationale: "Only the condition knows whether its value depends on the machine: a unit test's time does, the LCP of real users does not. The measurement stays as measured. ADR Limits scaled to the machine."
trigger: "a metric condition ends in scaled"
---
