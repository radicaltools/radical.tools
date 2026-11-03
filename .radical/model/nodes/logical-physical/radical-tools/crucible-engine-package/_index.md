---
id: "cfe506af-85ba-4664-8fdc-dcb1a6e3afc3"
type: "container"
label: "Crucible engine package"
technology: "TypeScript, tsup, npm"
---

apps/crucible: @radicaltools/crucible on npm, what another project writes its fuzz files with. It bundles @radical/crucible (fuzzSuite, the Fuzzer, known failures, survey, replay and the finding files) and leaves fast-check as its dependency and Vitest as an optional peer. Its version is the product version.
