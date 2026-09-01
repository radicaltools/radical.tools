# radical.tools

> **Live app:** [studio.radical.tools](https://studio.radical.tools) &nbsp;|&nbsp; **Architecture Hub:** [hub.radical.tools](https://hub.radical.tools) &nbsp;|&nbsp; **Manual:** [radical.tools/manual.html](https://radical.tools/manual.html)

An open-source software architecture design studio — diagram, document, and evolve architecture using C4, domain models, governance concepts, and AI assistance. Electron + React desktop app (also runs in the browser).

## Features

- **C4 model** — Person, Software System, Container, Component, Database, Web App, Queue, Relation
- **Domain & Governance elements** — Domain, ADR, Fitness Function, Requirement, Blueprint
- **Smart Layout** — SA-based auto-layout with crossing minimisation, edge-length optimisation, aspect-ratio penalty, and compound parent fitting
- **Multiple layout engines** — ELK (hierarchical/layered/force), webcola (live physics), custom Smart Layout pipeline
- **AI assistant** — chat with OpenAI / Anthropic / Gemini / Ollama to generate and modify diagrams
- **Architecture Hub** — browse and import 70+ curated architecture concepts (patterns, fitness functions, ADRs, requirements) from [hub.radical.tools](https://hub.radical.tools)
- **Multiple views** — Canvas, Matrix, Sequence, Treemap, Table, Wiki per diagram
- **Presentation mode** — fullscreen slides with navigation bar
- **Metamodel editor** — customise node types, relation types, and constraints
- **Time travel** — milestone-based snapshots with named undo/redo
- **Document manager** — multiple diagrams, localStorage + file-system backed
- **Export** — PNG/SVG export, JSON save/load, Electron file dialogs

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 29 |
| Bundler | electron-vite + Vite 5 |
| UI | React 18 + ReactFlow 11 |
| State | Zustand + Immer |
| Layout | ELK.js, webcola, custom SA pipeline |
| Language | TypeScript 5 |

## Getting started

**Prerequisites:** Node.js ≥ 20, npm ≥ 9

```bash
# Install dependencies
npm install

# Start in development mode (Electron, hot-reload)
npm run dev 

# Type-check
npm run typecheck

# Run tests
npm test

# Production build (outputs to out/)
npm run build

# Run built Electron app
npm start

# Build web-only renderer (for deployment to studio.radical.tools)
npm run build:web
```

## Project structure

```
src/
  main/           Electron main process (IPC handlers, file dialogs)
  preload/        contextBridge API surface exposed to renderer
  renderer/src/
    components/   React UI (Canvas, Toolbar, Panels, Modals, …)
    layout/       Layout algorithms (smartLayout, elkLayout, colaLayout, …)
    store/        Zustand stores (diagramStore, documentStore, hubStore)
    ai/           AI integration (providers: OpenAI, Anthropic, Gemini, Ollama)
    types/        C4 + metamodel TypeScript types
hub/              Architecture Concept Hub static site (hub.radical.tools)
website/          Marketing site (radical.tools)
infra/            Terraform — AWS S3 + CloudFront + Route53 + IAM (OIDC)
tools/
  vscode-radical/ VS Code extension for .radical file syntax highlighting
tests/            Vitest unit/integration tests + layout benchmarks
docs/             Architecture notes and improvement log
```

## Persistence formats

A model can be saved two ways:

- **Single file** — `*.c4.json`: the whole model in one JSON document.
- **Markdown folder** — the model exploded into human-readable, git-friendly files:

```
radical.md            manifest
nodes/…               one .md per element (a C4 system/container becomes a directory
                      with _index.md); geometry + custom fields live in the YAML
                      frontmatter, the element's prose in the body
relations.md          all relations as a single Markdown table
sequences/<name>.md   interaction sequences as ordered lists
views/<name>.md       views: identity (frontmatter) + node membership (list)
_layout.json          machine state — per-view positions/camera, default-view camera
snapshots.json        milestones (versioned model copies)
presentations.json    presentation slides
metamodel.json        element / relation type schema
hubTemplates.json     Architecture Hub import records
```

Semantic content (elements, relations, sequences, views, descriptions) is authored as
Markdown; only non-authored machine state stays in JSON sidecars. Older folders (positions
in `_layout.json`, plus `relations.json` / `sequences.json` / `views.json`) still load and
migrate to the newer layout on the next save.

## Running tests

```bash
# All tests (vitest)
npm test

# Watch mode
npm run test:watch
```

## License

MIT

