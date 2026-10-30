---
id: "85565274-ba9a-4907-bd77-8df441930b28"
type: "component"
label: "Sensor adapters"
technology: "Node.js"
---

apps/cli/src/sensors/: one module per tool behind one interface (name, what it reads, measure() returning measurements), listed in one registry. Built in to start with: command (a command's exit code and duration) and json (values picked from a JSON file by path). Adapters for other tools (k6, Lighthouse, a metrics query, …) are contributed by pull request to the radicaltools monorepo, each with a fixture of its tool's real output; the contract test runs every registered adapter on its fixture.
