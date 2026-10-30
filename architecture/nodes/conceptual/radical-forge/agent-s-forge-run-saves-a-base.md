---
id: "b471ceaf-dddf-4a35-b5b6-460f08e5e4ed"
type: "scenario"
label: "Agent's Forge run saves a base"
given: "an empty model folder outside git, with no .radical/base.json"
metrics: "test(apps/mcp/src/forge.test.ts › saves the model before the run as the base when there is none from git, and leaves a git base alone) passed"
then: "forge_start saves the empty model as the base, marked as a Forge run, and says so; the second start replaces it with the model before that run; the base from git is left as it was"
when: "an agent starts Forge, and later starts Forge again on the same folder; then a base from git is put in its place and Forge starts once more"
---
