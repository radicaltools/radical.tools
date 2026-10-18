---
id: "94c18c56-18fe-4a49-94e8-f1f2004c6760"
type: "fitness-fn"
label: "Wiki publication tests"
category: "structural"
tests: |
  packages/common/tests/wikiDocument.test.ts
  apps/cli/src/confluence.test.ts
  apps/e2e/tests/studio/wiki.spec.ts
threshold: "All Confluence export tests pass; export changes no source model file and publishing touches only a page carrying the selected view's marker."
---

Verify one shared wiki document builder supplies Studio and CLI with scope, hierarchy, fields, EARS sentences, relationship groups and glossary definitions; verify Markdown/native rendering, managed page publication, versioning, recovery and credential-safe failures.
