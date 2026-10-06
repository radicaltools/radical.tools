---
id: "fceb20d4-39ee-4174-8b4f-11aeac1bb0fd"
type: "fitness-fn"
label: "E2E regression"
category: "holistic"
threshold: "npm run e2e passes in CI, screenshots included"
---

apps/e2e: Playwright against the production web builds of Studio and Hub (boot, editing, export, folders, layout, physics, views, wizard, presentations, metamodel diagram, Hub), with screenshot comparison. .github/workflows/e2e.yml runs it from ci.yml and deploy.yml inside the Playwright image so rendering matches the committed baselines.
