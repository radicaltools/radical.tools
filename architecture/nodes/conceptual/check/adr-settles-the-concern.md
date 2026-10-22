---
id: "a1618356-817b-4069-9649-4bd09aee20f2"
type: "scenario"
label: "ADR settles the concern"
given: "the model of Open concern found with an ADR marked with the authentication concern"
tests: |
  packages/common/tests/check.test.ts › radical check: concerns › counts an accepted ADR marked with the concern on the element or what contains it, whatever it decides
  packages/common/tests/check.test.ts › radical check: concerns › names a proposed ADR and ignores a superseded or deprecated one and one on another element
  packages/common/tests/check.test.ts › radical check: concerns › suggests where to bind a pack: the smallest element that settles the most, and the fewest that settle all
then: "the concern is not reported while the ADR is accepted and constrains the web app or its system, whatever it decides; a proposed ADR leaves it reported as being decided, naming the ADR; a superseded or deprecated ADR, or one constraining another element, leaves it reported"
when: "the ADR constrains the web app or the system that contains it, decides on an authentication mechanism or that authentication does not apply, is proposed, superseded or deprecated, and radical check runs"
---
