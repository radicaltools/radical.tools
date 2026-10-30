---
id: "fceb20d4-39ee-4174-8b4f-11aeac1bb0fd"
type: "fitness-fn"
label: "E2E regression"
category: "holistic"
metrics: "test(apps/e2e/tests) passed"
---

apps/e2e: Playwright (Desktop Chrome, 1440 x 900, dark) against vite preview of the production web builds of Studio and Hub: boot, editing, files and folders, export, layout, physics, alignment, edge labels, views, matrix, wiki, wizard, need, Forge, Hub import, state machines, presentations, metamodel editor and diagram, Inspector, regressions from exploratory runs, and the Hub. Screenshot comparisons tolerate 0.5 % of pixels and run only on Linux (skipped elsewhere unless E2E_VISUAL=1); baselines come from the Playwright image. .github/workflows/e2e.yml runs the suite inside mcr.microsoft.com/playwright:v1.63.0-noble with two retries, in four shards side by side whose blob reports the E2E (Playwright) job merges (playwright.merge.config.ts) into the HTML report and reports/e2e.json, which radical check reads; that job fails when a shard failed and is the check main's branch protection requires. It is called by ci.yml on every pull request (skipped with the skip-e2e label) and by deploy.yml before every deploy. On a pull request a screenshot that differs from its baseline does not fail: the shard writes the new image, and ci.yml commits the new baselines to the branch, to review in the PR diff; before a deploy a difference fails.

Threshold: npm run e2e passes in CI (two retries, four shards) with screenshot diffs under 0.5 % of pixels before every deploy from main; on every pull request without the skip-e2e label it passes, with changed screenshots committed as new baselines.
