---
id: "dab95365-8c91-4cae-b130-0b5d985b43fc"
type: "entity"
label: "Measurement"
kind: "aggregate-root"
---

One value a sensor measured: the metric's name, the value, its unit and labels, with the source, time and context of the radical-metrics/1 file it came in. Kept in the model folder's .radical/measurements.json (outside git, the latest of each metric and labels) or read from the files radical check is given; never in the model's files. A measurement holds a value, not a verdict.
