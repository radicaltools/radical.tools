---
id: "c269f2b5-ef8a-4b37-8811-e9ce16541bcd"
type: "scenario"
label: "New view of a viewpoint"
given: "the Fintech sample on the Radical metamodel"
tests: |
  apps/e2e/tests/studio/viewpoints.spec.ts › New view offers the metamodel's viewpoints; a view of one follows the viewpoint
  packages/common/tests/viewpoints.test.ts › viewpoints › stay with a document on a preset when the preset is swapped in on load
  packages/common/tests/viewpoints.test.ts › viewpoints › make a view one of them, and the view follows the viewpoint when it changes
  packages/common/tests/viewpoints.test.ts › viewpoints › are left by a view whose kind or chain is set by hand
  packages/common/tests/viewpoints.test.ts › viewpoints › are saved from a view under a new name, or replace the viewpoint of that name
  packages/common/tests/viewpoints.test.ts › viewpoints › name a new view after the viewpoint, and say their chain in words
then: "New view offers Blank view and the viewpoints by group, Requirements holding Traceability, Requirement coverage, Requirement gaps, Responsibilities and Specification; the new view is a table named Traceability with needs, their requirements and their scenarios and a read-only filter; after saving the view is of Sorted trace, Governance gets its three levels and sort, the editor counts 2 views, both become wikis, and after the delete Governance stays a wiki of no viewpoint, the metamodel still the Radical preset; the engine applies, follows, leaves and saves viewpoints as its tests say"
when: "the user opens + New view and picks Traceability, detaches its filter, adds a sort by name and saves it as the viewpoint Sorted trace, picks Sorted trace in the Governance view's Viewpoint list, then sets Sorted trace to Wiki in the metamodel editor and deletes it"
---
