---
id: "8320a191-e2ad-47f0-ae18-dcd0e5cb9f7d"
type: "scenario"
label: "Flawed pack refused"
given: "a concern pack whose texts hold a {{KEY}} no question or detail defines, a detail no text uses, a token in an option's label and in a description, a snippet with a bare number beside a # KEY comment, a state-driven precondition starting with \"while\", an option no element is imported for and no decision names, and a fitness function imported for answers that import none of the ADRs it implements; and a spec whose requirement is named in no fitness function's checks, one whose checker is gated narrower than it, one unchecked with a blank reason, and one unchecked yet checked"
metrics: |
  test(packages/common/tests/concernPacks.test.ts › concernPackProblems › names what is wrong in the texts and across the answers) passed
  test(packages/common/tests/concernPacks.test.ts › concernPackProblems › passes a pack that meets the standard) passed
  test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › specProblems: every requirement is checked by a fitness function imported with it, or says why not) passed
then: "each flaw is named with the element and the key it concerns, an option that is decided is not reported, and a pack that meets the standard reports nothing"
when: "the catalogue's standard (concernPackProblems) and the spec standard (specProblems) run on it"
---
