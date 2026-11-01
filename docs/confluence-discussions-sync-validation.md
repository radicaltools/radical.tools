# Confluence discussion sync validation

The CLI-first implementation was exercised with mocked API regression tests and
an authenticated Confluence Cloud managed page tree. The disposable test comments,
local discussion/sync files, temporary wiki view and live-test scripts were removed
after verification. No account details, site URLs or live IDs are needed to repeat
the automated tests.

## Automated checks

- 40 sync/adapter/markup/CLI workflow tests and 32 existing publication tests pass.
- Common discussion validation and native storage: 6 tests each pass.
- Studio discussions, browser storage and cross-writer tests: 23 tests pass.
- CLI, common, node-files and Studio typechecks pass.
- The packaged CLI passes an offline production install, executable, version,
  help and model check outside the monorepo.

The sync regressions cover stable-ID crash recovery, uncertain creates, explicit
binding, parent-before-child ordering, deep replies, exclusions, unsupported
content, safe pagination (body and Link headers), original author metadata,
duplicate node labels, replaced/retained pages, partial reads, node scoping,
stale previews and version-2 browser compatibility.

The broader CLI and node-files suites encountered Windows path/shell/signal,
timeout and chmod-related failures during development. Focused checks above were
rerun successfully. Current PR validation results are recorded in the PR.

## Live verification

Tests used one existing managed node page and its landing page. No generated page
bodies were republished or rebound.

- Direct footer roots, replies and nested replies were created and read back.
- Local Radical roots/replies were sent to their mapped node page. Confluence
  roots/replies were imported with exact text, provenance and ancestry preserved.
- New replies across existing threads and a new root synced without duplication.
- Confluence sometimes acknowledged nested creates with the thread-root parent;
  subsequent reads returned the immediate parent. Verified IDs were safely bound,
  and sync now checkpoints acknowledged IDs before verifying a mismatch by ID.
- Paragraph `local-id` metadata and standard named entities were handled without
  admitting arbitrary HTML. Bold, italic, code, links, paragraphs and Unicode
  were compared after semantic normalization.
- A second native writer added a local reply immediately before an import write.
  That reply survived three inbound comments and was exported on the next run.
- A remote reply imported into a resolved thread kept it resolved and was flagged
  for review. The disposable thread was reopened after checking that behavior.
- Every additional round ended with zero imports, sends or remote write attempts.
  No pending or uncertain operations remained.

The last three rounds added nine comments. All 21 comments from the full trial
were subsequently deleted, with absence verified. Unrelated retained pages were
reported for review and left untouched.

## Remaining limits

These API trials do not establish a full browser/editor automation round trip,
live cursor pagination at scale, republishing behavior, live rate-limit behavior,
or cross-machine handoff. Native Studio-hosted sync, automatic scheduling,
edits/deletions/resolution sync and a dedicated review acknowledgement UI remain
outside this release. See the CLI README for credentials, compatibility,
permissions, privacy and recovery.
