---
id: "8e9fd817-9890-4838-a11e-81dad3887ac5"
type: "fitness-fn"
label: "Layout stands tests"
category: "structural"
tests: |
  packages/layout/tests/liveColaRest.test.ts
  packages/layout/tests/groupHoldPhysics.test.ts
  packages/layout/tests/smartLayout.test.ts
threshold: "The three suites pass in CI"
---

packages/layout/tests/liveColaRest.test.ts (a diagram with positions keeps them when opened and when its positions are replaced; an added element moves only itself and its surroundings; a diagram with no layout is still arranged; relaxLayout gives the same result every time, leaves its input untouched and refuses 150 nodes or more), packages/layout/tests/groupHoldPhysics.test.ts (an element related only to an open container comes back by it, stops at what is in its way without pushing it, stays where it was pinned) and packages/layout/tests/smartLayout.test.ts (Smart Layout scores the relaxed winner as a candidate and never returns a worse layout than it).
