---
id: "d8597ec6-9641-47e1-884e-67e00d6d101c"
type: "scenario"
label: "Limit scaled to the machine"
given: "the condition `test.duration.max{kind=unit} <= 100 ms scaled`, a measured 180 ms, and machine.speed 2.4 measured with it"
then: "the condition passes and its detail reads \"100 ms × 2.4 = 240 ms\"; with machine.speed 0.5 the limit stays 100 ms, as a limit is scaled never below ×1"
when: "the conditions are evaluated"
---
