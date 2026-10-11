---
id: "8fa37c3a-b582-420c-8c02-8b88ffda44ac"
type: "scenario"
label: "Unsafe wireframe sanitized"
gherkin: "# Covered by: packages/common/tests/forgeWireframe.test.ts › strips scripts, foreignObject, event handlers and external hrefs"
given: "wireframe markup containing a script, a foreignObject, an onclick handler and an external href"
then: "the stored SVG contains none of them and is rendered only as an image"
when: "the wireframe is stored on a mockup"
---
