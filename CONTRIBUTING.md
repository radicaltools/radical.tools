# Contributing to radical.tools

Thank you for your interest in contributing! This document explains how to get involved.

## Ways to contribute

- **Report bugs** — open a [bug report](https://github.com/radicaltools/radical.tools/issues/new?template=bug_report.md)
- **Request features** — open a [feature request](https://github.com/radicaltools/radical.tools/issues/new?template=feature_request.md)
- **Submit code** — fork the repo and open a pull request
- **Improve documentation** — fix typos, clarify explanations, add examples
- **Share architecture patterns** — contribute to the [Architecture Hub](https://hub.radical.tools) by adding a `.radical` concept under `packages/hub-catalogue/catalogue/`

## Development setup

**Prerequisites:** Node.js ≥ 20, npm ≥ 9

```bash
git clone https://github.com/radicaltools/radical.tools.git
cd radical.tools
npm install
npm run dev        # Electron app with hot-reload
npm test           # Run tests
npm run typecheck  # Type-check
```

## Project structure

npm workspaces monorepo; run commands from the repo root.

```
apps/
  studio/         — Radical Studio (Electron + web) and the Hub viewer
    src/main/       — Electron main process
    src/preload/    — Electron preload bridge
    src/renderer/src/
      ai/           — AI chat, providers and Forge
      components/   — Studio's own UI (toolbar, extra views, modals)
      persistence/  — Autosave between the diagram store and documents
      store/        — documentStore
    tests/          — Vitest unit tests
  vscode/         — VS Code extension
  hub/            — Architecture Hub read-only viewer
  mcp/            — MCP server (empty for now)
  web/            — Marketing site (radical.tools)
packages/
  common/         — @radical/common: model types, metamodels, formats, AI tools (no UI deps)
  layout/         — @radical/layout: Smart Layout and headless layout engines
  ui/             — @radical/ui: canvas, panels, views and the diagram store (Studio + Hub)
  host-bridge/    — @radical/host-bridge: Studio ↔ host contract (Electron, VS Code, browser)
  hub-catalogue/  — @radical/hub-catalogue: Hub concepts (.radical files), validation, Vite plugin
```

## Workspace boundaries

`npm run check:workspaces` (run in CI) enforces these rules:

- Packages (`packages/*`) depend only on other packages. Apps (`apps/*`) depend
  on packages, never on each other. The exceptions are listed with a reason in
  `tools/check-workspaces.mjs`.
- Reach another workspace through its package name and the entry points in
  its `exports`, never through a relative path.
- Declare every package you import in your workspace's `package.json`.
- Every workspace with `src/` has a `typecheck` script, and every workspace
  with tests has a `test` script.

## Daily workflow (for maintainers)

The `main` branch is protected — direct pushes are rejected. All changes go through a PR.
CI (`Type-check & Test`) must pass before merging.

Recommended git aliases (set up once globally):

```bash
git config --global alias.feature '!f() { git checkout main && git pull && git checkout -b "feature/$1"; }; f'
git config --global alias.hotfix  '!f() { git checkout main && git pull && git checkout -b "hotfix/$1"; }; f'
git config --global alias.done    '!git push -u origin HEAD && gh pr create --fill --web'
```

Then the daily loop is:

```bash
git feature my-feature-name   # pulls latest main, creates feature/my-feature-name
# ...make changes...
git add . && git commit -m "feat: describe change"
git done                       # pushes branch and opens PR in the browser
```

Branch naming: `feature/<name>`, `hotfix/<name>`, `docs/<name>`.

## Pull request process

1. **Create a branch** from `main` (use `git feature` / `git hotfix` above).
2. **Write or update tests** for changed behaviour (run `npm test`).
3. **Type-check** — `npm run typecheck` must pass with no errors.
4. **Keep PRs focused** — one feature or fix per PR.
5. **Describe what and why** in the PR description.
6. A maintainer will review and merge or request changes.

## Coding conventions

- TypeScript strict mode; no `any` unless unavoidable
- React functional components with hooks
- State via Zustand + Immer: the diagram store in `packages/ui/src/store/`, documents in `apps/studio/src/renderer/src/store/`
- Tests live in `tests/` and use Vitest

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add treemap export to PNG
fix: correct ELK layout for nested containers
docs: clarify metamodel editor usage
test: add sequence view collapse test
```

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
