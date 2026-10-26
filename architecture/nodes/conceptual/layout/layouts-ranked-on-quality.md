---
id: "7a9327cc-e421-4292-a7e8-e3a9add29f7c"
type: "scenario"
label: "Layouts ranked on quality"
given: "layouts differing in criteria of very different units, relations crossing at a shallow or a right angle, relations leaving one element in nearly one direction or spread, and groups of many sparsely linked elements"
tests: |
  packages/layout/tests/ranking.test.ts › aggregated quality
  packages/layout/tests/ranking.test.ts › crossing angle and angular resolution
  packages/layout/tests/packedGroups.test.ts › packed groups
  packages/layout/tests/packedGroups.test.ts › score scaling
  packages/layout/tests/packedGroups.test.ts › corridor crowding
  packages/layout/tests/smartLayout.test.ts › runSmartLayoutCore guarantees › returns no overlapping siblings and never loses to its own best candidate
then: "a layout wins on how much it differs from the others in each criterion, not on the units of one; a difference too small to mean anything does not decide; a layout several candidates came out as counts once; an overlapping layout never wins over one without overlap; the same winner comes out whatever layout the run starts from, and a second run keeps it; the layout on screen stays unless another is clearly better; shallow crossings and crowded angles are counted; sparse groups are packed in blocks with linked elements next to each other; six relations through one place count as a corridor and the same relations side by side do not; Smart Layout's winner has no overlapping siblings and is never behind its own best candidate by aggregated quality"
when: "the layouts are ranked, the crossings and angles are counted, and the groups are laid out"
---
