# Research: remark and EARS for `@radical/markdown`

Research date: 2026-10-05. This document reviews the plan in
[README.md](README.md), the current source, and upstream documentation. It
interprets “remarsk” as **remark**, the Markdown processing ecosystem.
Recommendations below are proposals for future work, not implemented behavior.

## Recommendation

Use the remark/mdast ecosystem when structured Markdown extraction is needed,
keep JSON Schema for metadata and any deliberately defined document projection,
and implement EARS checks in the optional requirements extension. Keep the
markdownlint work described below as the general style layer. These address
different concerns: recognizing Markdown, validating structured data, and
checking requirement sentences.

The README baseline's parser already produces mdast. A direct mdast parser is a
reasonable option for future extraction; adopting a unified/remark processor
becomes useful if compatibility with third-party remark plugins is an explicit
goal. Either route can support the README's requirement directives. This is an
architectural recommendation based
on the extension APIs documented by
[mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown#options)
and [remark-directive](https://github.com/remarkjs/remark-directive).

Keep WP06 and WP07 optional, as the README specifies. Neither remark nor an EARS
checker provides the workspace identity, symbol resolution, or traceability
engine planned in WP03–WP05.

## Repository observations and ongoing changes

At the initial read, the [implementation](src/index.ts) matched the supplied
README: it parsed YAML frontmatter, selected an Ajv schema using `type`, parsed
the body with `fromMarkdown`, and projected document-level headings into a
hierarchy. The schema validated `{ frontmatter, headings }`. Diagnostics used
original-document UTF-16 offsets, with fixtures for heading structure,
frontmatter failures, and source locations.

The broader README work was planned against that baseline:

| Area | README baseline behavior | Planned addition |
| --- | --- | --- |
| Identity | `type` required for frontmatter documents; `id` optional | Workspace node IDs and duplicate handling in WP02–WP03 |
| Parsing | YAML and headings | Preserved body, additional node syntax, and extension hooks in WP02 |
| References | No resolver | Node and nested-symbol navigation in WP04 |
| Validation | Type-specific, synchronous JSON Schema | Validator registry and workspace context in WP05 |
| Requirements | No requirement-block extraction | Optional symbols and traceability in WP06 |
| EARS | No sentence checks | Configurable structure and quality rules in WP07 |

Other edits appeared in the shared workspace during this investigation. At the
final code inspection, the implementation instead imported `markdownlint/sync`,
accepted base and type-specific lint configuration plus custom rules, and applied
optional Ajv schemas directly to frontmatter. Ordinary Markdown was now linted;
heading checks used MD043 in the examples. The manifest and source agreed on
`markdownlint`. An import/manifest mismatch observed at the initial read was
therefore transient, not an outstanding finding.

The supplied README still described the earlier heading-tree/schema API at that
inspection. Reconcile that documentation with the completed implementation in its
own work. This research does not assess completion or test results of those
concurrent edits. Future remark integration should account for this changed
baseline rather than assume the old `{ frontmatter, headings }` API is retained.

## What remark supplies

[remark](https://github.com/remarkjs/remark) processes Markdown through plugins
and uses mdast syntax trees. CommonMark is the default; additional syntax such as
GFM needs explicit plugins. The ecosystem supplies syntax infrastructure, while
application-specific meaning belongs to our validators.

| Package or layer | Relevance to this plan | What we still own |
| --- | --- | --- |
| `mdast-util-from-markdown` | CommonMark-to-mdast parser from the README baseline; supports token and AST extensions | Projection into our public model and diagnostics |
| `unified` + `remark-parse` | Alternative orchestration with a remark plugin pipeline | Workspace state, execution policy, public contracts |
| `remark-frontmatter` | Recognizes frontmatter as an AST node | YAML decoding, field validation, parser-error ranges |
| `remark-directive` | Recognizes generic container, leaf, and text directives | Meaning of `requirement`, IDs, trace attributes, and body policy |
| `remark-lint` | Optional Markdown style rules | Domain checks and translation to our diagnostic contract |
| `remark-gfm` | Optional GFM syntax | Decision on the supported Markdown dialect |

`remark-frontmatter` explicitly does **not** decode its YAML payload. Keep the
existing `yaml` parser or an equivalent explicit decoding step. See its
[API notes](https://github.com/remarkjs/remark-frontmatter#api).

`remark-lint` checks Markdown style and reports messages; its severity semantics
can include exceptions. It is not a ready-made EARS validator or workspace
resolver. Translate any adopted rules into WP05's diagnostics and error policy
instead of making remark's exception behavior the public contract. See
[remark-lint configuration](https://github.com/remarkjs/remark-lint#configure).

[markdownlint](https://github.com/DavidAnson/markdownlint) is a Markdown style
checker with custom-rule support. It does not expose the same API as
`mdast-util-from-markdown`. In the later workspace snapshot it is already the
general style engine. A future mdast pipeline should have a specific extraction
purpose; adopting remark does not also require running `remark-lint`.

### Two viable parser routes

**Direct mdast route:** use `mdast-util-from-markdown` and register the
appropriate micromark syntax extensions and mdast conversion extensions. For
directives, these are `micromark-extension-directive` and
`mdast-util-directive`. Frontmatter has corresponding extension packages if we
choose to parse the entire document as one tree. The distinction between token
extensions and AST extensions is documented in
[the parser options](https://github.com/syntax-tree/mdast-util-from-markdown#options).

**Remark route:** use `unified`, `remark-parse`, and selected syntax plugins, then
project the resulting mdast into the same library model. Validation can use
`parse` followed by `runSync` for synchronous transforms, or `run` for an explicit
async API. Calling `parse` alone does not run transform plugins. A compiler or
`remark-stringify` is unnecessary when only inspecting a tree; `process` also
performs compilation. See the
[unified processing API](https://github.com/unifiedjs/unified#api).

Recommendation: settle the extension-registration contract in WP02 before
choosing orchestration. Preserve the existing synchronous Phase 0 API. If WP05
later supports asynchronous company validators, expose that behavior explicitly
rather than silently changing the return type.

## Requirement directives: fit and gaps

The README's proposed block fits generic container-directive syntax:

```md
:::requirement{#FR-010 traces="billing-policy/BR-010"}
When an invoice is approved, the Invoice API shall record the approval.
:::
```

`remark-directive` adds syntax support but does not interpret directives. Its
upstream example uses the same container and ID-shortcut form. We would extract
only `containerDirective` nodes named `requirement` in configured document types.
See [remark-directive usage and API](https://github.com/remarkjs/remark-directive#use).

The AST exposes `name`, `attributes`, and children. `#FR-010` becomes an `id`
attribute; `traces` remains application-owned data. Attribute values are not a
domain schema, and the documented node type does not give each attribute its own
source span. Exact ID or trace-token diagnostics therefore need additional
source mapping; a whole-block range is a reasonable initial fallback. See
[mdast-util-directive's types](https://github.com/syntax-tree/mdast-util-directive#containerdirective).

Important syntax behavior: a missing closing fence can extend a container to its
parent's end, and multiple ID attributes collapse to the last value. Consequently,
parser success does not prove that a requirement block is well formed under our
rules. If we require explicit closing fences or reject repeated ID attributes,
WP06 needs source-level checks. Nesting uses longer outer fences. See
[the directive syntax specification](https://github.com/micromark/micromark-extension-directive#syntax).

Proposed initial authoring policy, to be decided in WP06:

- Each requirement has a non-empty local ID and one statement paragraph;
  wrapping that paragraph across lines is allowed. Additional rationale needs an
  explicitly defined representation.
- Requirement blocks occur at document level. Examples inside code, quotations,
  lists, or another requirement do not register symbols. Placement rules need
  ancestor-aware traversal, not an unrestricted recursive search.
- Explicit closing fences are required. Inline formatting is allowed only with
  a documented text-extraction and source-mapping policy.
- Define the encoding of multiple `traces` targets before supporting them.
  The current single-target example does not settle separators or escaping.
- Resolve local IDs within the containing node and qualified IDs through the
  workspace index. Missing and ambiguous targets remain separate outcomes.

The README's `[[billing-policy]]` notation is a separate syntax decision. The
listed directive/frontmatter plugins do not add wiki-link syntax; WP04 still
needs a chosen extension or a deliberate reference grammar. Define escaping and
handling of code and HTML before implementing it.

## EARS: what should be checked

EARS means **Easy Approach to Requirements Syntax**. Its author describes five
basic patterns and combinations of them. Conditions precede the system and its
response. The generic rules allow zero or more preconditions, zero or one
trigger, one system name, and one or more responses. A rule requiring exactly
one response would therefore be an additional company policy. Source:
[Alistair Mavin's EARS guide](https://alistairmavin.com/ears/).

The following examples are written for this investigation:

| Pattern | Distinguishing clause | Example |
| --- | --- | --- |
| Ubiquitous | Unconditional obligation | The Invoice API shall retain approval records for 365 days. |
| Event driven | `When` introduces a trigger | When an invoice is approved, the Invoice API shall record the approval. |
| State driven | `While` introduces a continuing state | While maintenance mode is active, the Invoice API shall reject new approval requests. |
| Optional feature | `Where` introduces feature applicability | Where audit export is enabled, the Invoice API shall provide a daily export. |
| Unwanted behavior | `If` and `then` introduce an undesired situation and response | If an approval request has an invalid signature, then the Invoice API shall reject the request. |
| Complex | Combines conditions | While maintenance mode is active, when an approval request arrives, the Invoice API shall return status 503. |

Pattern names and clause roles follow the
[author's guide](https://alistairmavin.com/ears/). These are sentence structures,
not proof of correct or complete product behavior.

The original paper also discusses `During` as an alternative state keyword and
combinations involving optional features and unwanted behavior. A checker that
only accepts the six examples above is implementing a subset, not the whole
notation. The paper reports residual ambiguity and cautions against assuming
missing requirements have all been identified. Source: Mavin, Wilkinson, Harwood,
and Novak, *Easy Approach to Requirements Syntax*, RE 2009,
[DOI: 10.1109/RE.2009.9](https://doi.org/10.1109/RE.2009.9),
[author-uploaded paper](https://www.researchgate.net/publication/224079416_Easy_approach_to_requirements_syntax_EARS).

### Proposed WP07 rule groups

These rule codes and severities are proposals, not existing exports:

| Rule | Intended check | Suggested default |
| --- | --- | --- |
| `EARS_STRUCTURE` | A supported clause pattern with non-empty clause content; report unsupported combinations explicitly | Error when EARS policy is enabled |
| `EARS_MODAL` | Required obligation wording, normally `shall`, in the main obligation clause | Error when enabled |
| `EARS_SYSTEM` | Named system before the obligation; optionally matched against caller-supplied system names | Error for an absent slot; configurable for terminology |
| `EARS_RESPONSE` | Non-empty response after the obligation | Error when enabled |
| `REQ_AMBIGUOUS_TERM` | Caller-configured vague terms such as “quickly” or “as appropriate” | Warning |
| `REQ_TERMINOLOGY` | Caller-configured preferred or forbidden terms | Warning |
| `REQ_ATOMICITY` | Possible multiple independent obligations | Off initially; heuristic warning if enabled |

Keep requirement IDs, duplicate symbols, and broken traces in WP06. Keep EARS
structure checks distinct from writing-policy warnings. JSON Schema can validate
extracted attributes or structured clause fields, but it does not by itself
extract reliable EARS clauses from natural-language prose.

Recommendation: recognize a documented set of clause forms, split the statement
into source-backed spans, and validate each slot. Match control words at clause
boundaries; a keyword anywhere in the sentence is not sufficient. System names
from configuration make the system/response boundary less ambiguous. Start with
the five basic patterns, the README's event example, and selected documented
complex forms; label unsupported forms clearly and broaden through fixtures.

Capitalization and punctuation tolerance, `During`, alternative modal words, and
supported complex combinations need an explicit policy. Initial English support
should be documented; keyword translation alone does not define another
language's grammar.

A passing sentence can still be vague: “The Invoice API shall respond quickly.”
Conversely, `and` can join objects or conditions within a valid requirement.
Do not automatically split statements, invent thresholds, change `should` to
`shall`, or rewrite `When` as `If`: those edits can change the obligation.
Only offer a fix when both meaning and the original source span are known.

## Source locations and diagnostics

unist positions use one-based lines/columns and zero-based UTF-16 offsets. This
matches the package's offset unit, but consumers must not confuse the coordinate
systems. See [unist Point](https://github.com/syntax-tree/unist#point).

If parsing a body substring, add `bodyStart` to every reported offset, as the
README baseline's heading validator did. If parsing the whole document, offsets already
refer to the original input. Preserve raw text for navigation and fixes.

Flattened prose is not necessarily the source text: emphasis, escapes, entities,
links, and line wrapping can change lengths. Keep a mapping from extracted text
spans to original AST/source spans. Until that mapping is available, report the
paragraph or block and omit token-level fixes. Cover CRLF, bare CR, BOM, and emoji
in the future fixtures.

## How this affects the work packages

| Work package | Decision or deliverable informed by this research |
| --- | --- |
| WP01 | Keep generic ranges and diagnostics independent of mdast and requirements; allow future domain rule codes and severity |
| WP02 | Choose direct mdast or remark orchestration; specify dialect, parser extension registration, and frontmatter/body offset strategy |
| WP03–WP04 | Establish qualified IDs, resolver outcomes, update invalidation, and reference syntax before trace checks |
| WP05 | Define execution, configuration, and plugin-failure behavior; adapt external lint messages if adopted |
| WP06 | Extract directives, check IDs and fences, register symbols, resolve traces, and preserve source spans |
| WP07 | Add explicitly supported EARS forms and separate configurable quality rules |
| WP08 | Demonstrate fictional company system names, terminology, rule toggles, and severity |
| WP09–WP10 | Verify equivalent adapter diagnostics and declared dependencies in an isolated package consumer |

Before implementation, settle the parser route, directive placement/body policy,
ID grammar, trace encoding, reference notation, EARS subset, and text mapping.
These decisions extend the README's plan; they do not require moving domain
rules into the core or delaying the generic-library release.

## Suggested future acceptance fixtures

1. Preserve the agreed public behavior and original offsets under the chosen
   parser route. Explicitly settle ordinary Markdown handling and whether heading
   rules use the README's JSON projection or the newer MD043 configuration.
2. Extract a requirement only from a configured type; ignore identical syntax
   in code and excluded ancestors.
3. Reject missing IDs, repeated local IDs, and source-level malformed blocks;
   accept the same local ID in different documents.
4. Resolve local and qualified traces; distinguish missing and ambiguous targets;
   remove stale symbols and reverse references after an update or deletion.
5. Accept each basic EARS pattern and documented complex forms. Reject empty
   slots, missing main obligation wording, and broken `If`/`then` structure.
6. Exercise quoted keywords, conjunctions, multiline text, inline formatting,
   and unsupported complex forms to expose false positives.
7. Show that rule toggles and company terminology affect only opted-in checks;
   malformed documents and plugin failures have the outcomes specified in WP05.
8. Confirm exact original spans across line endings and non-ASCII input. Offer
   no quick fix when text normalization leaves the replacement range uncertain.

This change adds research documentation only. No dependencies, implementation,
README content, or existing tests were changed, and no build/test execution is
claimed.
