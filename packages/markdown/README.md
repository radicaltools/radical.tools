# @radical/markdown

Validate Markdown headings and subheadings using rules written in JSON Schema.

**Status:** the initial package works. It includes a built library, TypeScript
declarations, example schemas and documents, and editor-independent diagnostics.
It remains private while public release preparation is pending. The larger plan
below remains available for later work.

## Phase 0 — Simple package example

For a document with frontmatter `type: x`, require this structure:

```md
---
type: x
---

## Overview

## Details

### Inputs

### Outputs

## Acceptance
```

The package checks the heading names, levels, parent sections, and order. The
rules live in [`examples/x.schema.json`](examples/x.schema.json), a standard
JSON Schema draft 2020-12 document. No document types are built into the library.

### Run it

From the repository root:

```bash
npm install
npm run example -w @radical/markdown
```

The example checks [`valid.md`](examples/valid.md) and
[`invalid.md`](examples/invalid.md). The valid file returns no diagnostics. The
invalid file has reversed headings/subheadings and a missing Acceptance section.
See [`examples/validate.mjs`](examples/validate.mjs) for the complete runnable code.

### Use the package

```js
import { readFile } from 'node:fs/promises';
import { createValidator } from '@radical/markdown';

const schema = JSON.parse(await readFile('./x.schema.json', 'utf8'));
const validate = createValidator({ x: schema });

const text = await readFile('./document.md', 'utf8');
const diagnostics = validate({ uri: 'document.md', text });
console.log(diagnostics);
```

Create the validator once and reuse it when document text changes. For a one-off
call, `validateDocument({ uri, text }, { x: schema })` provides the same behavior.
Add another schema under another type key to validate additional document types.

### How JSON Schema expresses the rules

Markdown is parsed into a JSON structure with `frontmatter` and a heading tree.
For example, the Details section becomes:

```json
{
  "title": "Details",
  "level": 2,
  "children": [
    { "title": "Inputs", "level": 3, "children": [] },
    { "title": "Outputs", "level": 3, "children": [] }
  ]
}
```

The schema validates this structure using standard keywords:

- `const` fixes a heading title or level.
- `prefixItems` defines the order of headings in an array.
- `minItems` makes every listed heading required.
- `maxItems` limits extra or duplicate headings.
- `properties.children` applies the same rules to subheadings under their parent.
- `properties.frontmatter` can also check company fields such as `owner`.

The example schema requires exactly three root sections and exactly two children
under Details. It accepts prose between headings. Heading titles are case
sensitive; inline Markdown formatting is removed and whitespace is normalized.
Real Markdown parsing handles both `#` and underlined headings, while ignoring
headings inside code, quotes, lists, and HTML comments.

A `# Document title` is a real heading and becomes a parent of following `##`
sections. If you add one, adapt the schema to wrap the section rules under that
heading's `children`. Schemas always describe the actual heading tree.

### Package contract for your colleague

The package accepts `{ uri, text }` and returns `Diagnostic[]`. It has no filesystem
or editor dependencies; the consuming application loads documents and schemas.
Each diagnostic contains:

| Field | Meaning |
| --- | --- |
| `code` | `FRONTMATTER_INVALID`, `TYPE_MISSING`, or `SCHEMA_VALIDATION` |
| `message` | Description of the failed check |
| `severity` | `error` in this version |
| `uri` | The caller's document URI |
| `range` | Zero-based UTF-16 offsets into the original text; end is exclusive |
| `instancePath` | JSON Pointer into the parsed structure, for schema errors |
| `schemaPath`, `keyword` | The failed JSON Schema constraint, for schema errors |

Heading errors point at the corresponding heading. Missing subheadings point at
the parent heading; missing root headings and frontmatter errors use the
frontmatter block. YAML syntax errors use the parser's source range. LF, CRLF,
bare CR, and non-ASCII text preserve original offsets.

Your colleague owns the VS Code extension and can map these offsets using
`document.positionAt()`. Their integration can start with this function and the
example schema. Extension implementation is a separate work package.

Plain Markdown without frontmatter is ignored. Documents with frontmatter need a
non-empty string `type`; `id` is optional in this initial version. Unconfigured
types receive frontmatter checks only. Invalid documents return diagnostics.
Invalid schemas throw when creating the validator. Schemas compile in Ajv strict
mode, are synchronous, and use draft 2020-12; references must resolve within the
supplied schemas. The library
does not fetch remote schemas or provide extra format validators.

### Build and handoff

```bash
npm run typecheck -w @radical/markdown
npm run test -w @radical/markdown
npm run build -w @radical/markdown
npm pack -w @radical/markdown
```

The tarball includes JavaScript, declarations, the MIT license, this README, and
runnable examples. A colleague can install it in another project using
`npm install /path/to/radical-markdown-0.0.0.tgz` and import `@radical/markdown`.
The package currently exports ESM. Public npm publication remains part of WP10.

## Purpose

Treat each Markdown document as a node identified by frontmatter. The core
provides parsing, identity, indexing, symbols, references, and diagnostics.
Extensions add meaning for requirements, services, decisions, policies, or
company-defined document types.

The goal is a standalone library that a company can use in its own tooling
without running Radical Studio. Shared infrastructure lives in open source;
company rules and document content can live in the consuming repository.

This plan adapts the generic node validation proposal into deliverable work
packages. Examples illustrate the design; syntax and API names are provisional.

## Design boundaries

- The core knows about generic nodes, symbols, references, validators, and
  diagnostics. It does not depend on requirements or other domain extensions.
- Node IDs are unique within a workspace. Nested symbol IDs are local to a node
  and resolve through a qualified name such as `billing/FR-010`.
- Node type controls extension selection. A custom type can use the generic
  infrastructure without implementing a domain validator.
- The library accepts document text and URIs from its caller. File discovery,
  editor state, and command execution belong to adapters.
- Diagnostics and source locations are shared across consumers. Monaco, VS Code,
  and CLI code translate these into their own presentation formats.
- Public modules must work outside this monorepo without importing Studio,
  Electron, React, or unpublished Radical workspace packages.

Start with one package and separate modules. Split extensions into additional
packages only when independent dependencies or releases justify it. Dependencies
flow from adapters to extensions and core, and from extensions to core.

## Example company use case

A company keeps service descriptions, decisions, and requirements in one docs
workspace. A service document might look like:

```md
---
id: invoice-api
type: service
title: Invoice API
owner: finance-platform
---

# Invoice API

Implements [[billing-policy]].
```

The core checks document identity and resolves `billing-policy`. A company plugin
checks that `owner` matches the company's team directory. A requirements extension
can separately interpret a `requirement-document` containing:

```md
:::requirement{#FR-010 traces="billing-policy/BR-010"}
When an invoice is approved, the Invoice API shall record the approval.
:::
```

That nested requirement resolves as `billing/FR-010` when its containing node has
ID `billing`. Other document types do not run requirement rules. The sample
frontmatter, link notation, and directive syntax will be finalized in WP02,
WP04, and WP06 respectively.

## Work packages

Phase 0 above is implemented. The broader work packages below describe further
work; the initial heading validator does not complete them. Each has a deliverable
and a completion condition so it can become a separate issue or pull request.

| Work package | Deliverable | Depends on |
| --- | --- | --- |
| WP01 | Core contracts and source locations | — |
| WP02 | Markdown and frontmatter parsing | WP01 |
| WP03 | Workspace index and node identity | WP02 |
| WP04 | Symbols, references, and navigation | WP03 |
| WP05 | Validator registry and diagnostics | WP01, WP03 |
| WP06 | Optional requirements extension | WP04, WP05 |
| WP07 | Optional requirement quality rules | WP06 |
| WP08 | Company configuration and plugin example | WP04, WP05 |
| WP09 | CLI and editor adapters | WP04, WP05 |
| WP10 | Standalone package build and first release | WP01–WP05, WP08 |

### WP01 — Core contracts and source locations

Define public types for nodes (`id`, `type`, optional `title`, URI, frontmatter,
body), symbols, references, diagnostics, related locations, and text edits. Keep
the initial zero-based UTF-16 offset convention and define how additional symbol
locations map back to the original document.

**Done when:** contracts type-check without browser or editor dependencies and
location examples cover LF, CRLF, and non-ASCII text. Domain fields remain
extension-owned.

### WP02 — Markdown and frontmatter parsing

Extend the initial Markdown/YAML parsing and document supported node syntax. Preserve
the body and original source positions. Report malformed frontmatter, missing or
invalid `id`/`type`, and invalid optional fields as diagnostics. Decide explicitly
how plain Markdown without node frontmatter is handled.

**Done when:** fixtures cover valid custom types, invalid YAML, missing identity,
empty files, and original-file ranges. A bad document returns diagnostics without
preventing other documents from being processed.

### WP03 — Workspace index and node identity

Build an index from caller-supplied documents, resolving IDs to nodes and URIs.
Handle duplicate IDs without silently overwriting nodes. Support add, replace,
and remove operations so editors can validate an updated workspace.

**Done when:** duplicate identity reports both locations, lookups have defined
missing/ambiguous outcomes, and document updates remove stale index entries.

### WP04 — Symbols, references, and navigation

Define generic node-reference syntax and extension hooks for nested symbols.
Provide resolution, definitions, and reverse reference lookup. Specify qualified
IDs and the treatment of local references, unresolved targets, and code blocks.

**Done when:** two documents can contain the same local symbol ID without
collision; qualified references resolve correctly; updates keep forward and
reverse lookups consistent; examples distinguish prose references from code.

### WP05 — Validator registry and diagnostics

Let validators declare supported node types and run against a read-only workspace
context. Define stable rule codes, severity, message, URI, source range, optional
related information, and optional quick-fix edits. Decide execution order,
synchronous/asynchronous support, and plugin error handling.

**Done when:** only matching validators run, custom types work without built-in
domain rules, diagnostic output is deterministic, and a failing plugin has a
documented outcome. The core contains no requirement-specific checks.

### WP06 — Optional requirements extension

Parse requirement blocks for explicitly supported node types. Represent local
IDs, qualified IDs, text, attributes, and source ranges. Register requirements as
nested symbols and validate missing/duplicate IDs and broken traceability targets.

**Done when:** local and cross-document references resolve, duplicate IDs in one
document fail, reused local IDs in different documents succeed, and unrelated
types are unaffected. Parsing remains outside the generic core.

### WP07 — Optional requirement quality rules

Add configurable EARS structure checks, required wording, ambiguity checks, and
terminology rules. Keep structural errors separate from configurable writing
policy. Supply safe quick fixes only when the replacement is unambiguous.

**Done when:** rule fixtures cover accepted and rejected sentences, each rule can
be enabled or disabled, terminology is caller-configurable, and fixes target the
original source accurately. Any heuristic rule documents its limitations.

### WP08 — Company configuration and plugin example

Define configuration for plugin registration, type selection, rule severity, and
company terminology. Provide an example service-ownership validator and a small
mixed-document workspace using fictional company data. Demonstrate invocation
from a separate consuming application.

**Done when:** the consumer adds a custom type and company rule without changing
the core, controls which rules run, and receives navigable diagnostics. Example
data and rules do not rely on internal company services or credentials.

### WP09 — CLI and editor adapters

Deliver adapters as separate increments: CLI validation for CI, Monaco markers
and navigation, then VS Code diagnostics and language features. Keep filesystem
access and editor SDK dependencies outside the core. Specify CLI output and exit
codes; translate generic ranges, severity, and fixes at the adapter boundary.

**Done when:** the same fixture produces equivalent rule codes and locations in
each delivered adapter. The CLI has deterministic output and documented failure
exit codes; editor updates clear obsolete diagnostics and references.

### WP10 — Standalone package build and first release

Settle the public package name and entry points, add compiled JavaScript and type
declarations, and define supported runtimes and compatibility policy. Include the
MIT license and usage documentation. Verify the tarball in a clean consumer
outside the workspace; replace internal source imports with public entry points.

**Done when:** `npm pack --dry-run` lists only intended assets, the packed library
works in the clean consumer, and package exports and declarations resolve. Choose
the release version, configure public publication, and remove `private` when the
first release is ready.

## Delivery order

0. **Initial package (implemented):** validate one document against a type-specific
   JSON Schema and hand the package to the extension author.
1. **Generic library:** WP01–WP05 establish parsing, indexing, references, and
   validation without domain assumptions.
2. **Company pilot:** WP08 proves external use with one custom validator. WP10
   prepares the first independently consumable release.
3. **Requirements support:** WP06 and WP07 add optional domain behavior.
4. **Tooling:** WP09 exposes the same engine in CI and editors. Individual adapters
   can ship as their prerequisites become available.

Requirements rules and editor adapters are optional extensions; they do not block
the first generic-library release. Verification grows with each implementation
work package through parser fixtures, resolution tests, plugin tests, and a packed
consumer check.

## Current workspace

This package is registered through the root `packages/*` npm workspace pattern.
Its public entry point exports `createValidator`, `validateDocument`, and the
document, heading, schema, diagnostic, and range types. Inspect its metadata from
the repository root with:

```bash
npm pkg get name version private -w @radical/markdown
npm run check:workspaces
```

Keep the public API documentation and examples current as further work packages
are completed.

## License

[MIT](LICENSE), consistent with the repository license.
