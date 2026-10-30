---
id: "f6b9184c-e5cc-4c22-8d93-213f49104a12"
type: "requirement"
label: "Sensors run what the model measures"
action: "the CLI shall run every line of the measure of each automated fitness function triggered on that event with its sensor, write what each measured as a radical-metrics/1 file in the directory, and name each line it could not measure and why."
ears_type: "event-driven"
rationale: "What runs is the model's, and the workflow only says when (ADR Fitness functions classified as the book does). Evidence: apps/cli/src/sense.ts (runCommand)"
trigger: "`radical sense run --trigger <event> --out <dir>` runs on a model"
---
