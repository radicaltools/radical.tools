---
id: "e5b43c10-b2f4-44cf-89c0-7eb6bb445036"
type: "scenario"
label: "Element page as article"
given: "the sample's Architecture Wiki open in Viewer on Payments Service"
tests: "apps/e2e/tests/studio/wiki.spec.ts › wiki › an element page reads as an article"
then: "it shows the title, the byline \"Container in Banking Services\", outgoing then incoming relations as sentences, short facts in the infobox, components under a \"Components (2)\" heading, and no edit buttons"
when: "the user reads the page"
---
