---
id: "80254fe7-018e-43f5-bc87-541db0fc555c"
type: "scenario"
label: "Focus switched off"
given: "the sample model's All elements canvas"
metrics: |
  test(apps/e2e/tests/studio/selection-focus.spec.ts › the Focus switch on the canvas turns the dimming off and on, and is remembered) passed
  test(packages/ui/tests/canvasFocus.test.ts › focus off: no focus) passed
  test(apps/e2e/tests/studio/selection-focus.spec.ts › with Focus off a click on an element leaves the camera where it is) passed
then: "with Focus off no element or relation is dimmed and the switch reads off, also after the reload; with Focus on again the elements not related to Accounts Service are dimmed; with Focus off the clicks leave the camera where it is"
when: "the user turns Focus off on the canvas controls and selects Accounts Service, then reloads, then turns Focus on and selects it again; and, with Focus off, clicks elements and the empty canvas after the camera was moved"
---
