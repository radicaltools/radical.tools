---
id: "ed8903cc-7c53-458b-a03d-9b0294fbc20c"
type: "scenario"
label: "Unsafe SVG sanitised"
gherkin: |
  And a reply over 20,000 characters is refused
  # Covered by: apps/studio/tests/mockupWireframe.test.ts › sanitizeWireframeSvg › strips scripts, foreignObject, event handlers and external hrefs
given: "the provider returns an SVG with a script, an onclick handler, a foreignObject and an external href"
then: "all of these are stripped and only inert SVG remains"
when: "the wireframe is stored"
---
