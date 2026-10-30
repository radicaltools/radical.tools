---
id: "85905679-2235-47b3-8321-b7ef18209b9b"
type: "component"
label: "Sense command"
technology: "Node.js, node:util parseArgs"
---

apps/cli/src/sense.ts: `radical sense <adapter> [input]` runs one sensor adapter on a tool's output (or on a command) and adds what it measured to the model folder's .radical/measurements.json (the latest of each metric and labels; the folder must hold a model), or writes a radical-metrics/1 file where --out says (an artifact for another CI job). --label k=v adds labels, --context k=v the file's context. It measures and never judges: it reads no threshold, and its exit status says only whether it could measure (0) or not (2). `radical sense --list` lists the registered adapters.
