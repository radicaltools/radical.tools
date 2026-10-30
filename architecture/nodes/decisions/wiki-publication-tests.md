---
id: "94c18c56-18fe-4a49-94e8-f1f2004c6760"
type: "fitness-fn"
label: "Wiki publication tests"
category: "structural"
metrics: |
  test(packages/common/tests/wikiDocument.test.ts) passed
  test(apps/cli/src/confluence.test.ts) passed
  test(apps/e2e/tests/studio/wiki.spec.ts) passed
---

Verify one shared wiki document builder supplies Studio and CLI with scope, hierarchy, fields, EARS sentences, relationship groups and glossary definitions; verify Markdown/native rendering, managed page publication, versioning, recovery and credential-safe failures.

Threshold: All Confluence export tests pass; export changes no source model file and publishing touches only a page carrying the selected view's marker.
