---
id: "c3c6e13f-18a4-42c8-9b96-8f0375d1778e"
type: "scenario"
label: "Wiki depth in view properties"
given: "the Core Banking Platform wiki page in Designer, in Multi page"
tests: "apps/e2e/tests/studio/wiki.spec.ts › wiki › the Depth in the view properties sets how many levels Multi page writes out"
then: "the properties have no Auto-layout; at 1 level the domains are chapters and their containers only named; at 2 levels Payments Service is a chapter too; no menu offers a Wiki multi-page depth"
when: "the user opens the view's properties and sets Depth from 1 level to 2 levels"
---
