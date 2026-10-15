---
id: "f2d51835-1d89-4283-a8b9-6f3b3e060f05"
type: "system"
label: "GitHub"
external: true
---

Source, issues and pull requests (radicaltools/radical.tools). GitHub Actions: ci.yml runs on every pull request into main the workspace boundary check, type-check and tests (keeping a Vitest JSON report per workspace, artifact test-reports, via tools/test-reports.mjs), the E2E suite (unless labelled skip-e2e; report in e2e-report, with reports/e2e.json) and the MCP package check on Linux and Windows with Node 20 and 24. deploy.yml runs on every push to main: E2E first, then the checks and tests, then it builds Studio and the Hub and uploads them and the website to AWS through an OIDC role (no long-lived keys). release.yml drafts a GitHub Release with unsigned macOS, Windows and Linux installers on a v* tag that matches apps/studio/package.json (pull requests touching the packaging only build them); vscode-publish.yml publishes the VS Code extension on vscode-v* tags; the manual mcp-publish.yml verifies the npm tarball and, when not a dry run and on main, publishes that archive with npm Trusted Publishing and provenance. The E2E suite (e2e.yml) runs in four shards; on a pull request the screenshots that changed are committed to the branch by the job Commit new screenshot baselines, which then starts ci.yml by hand on that commit (a GITHUB_TOKEN push starts no workflow). Once the tests and the E2E suite are done, the job Architecture model runs radical check on architecture/ with that run's reports and fails on an error.
