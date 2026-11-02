---
id: "d78b87dc-4400-4253-9c57-696022dcae6d"
type: "scenario"
label: "Designer stays on the view shown"
given: "the bookstore Containers view open in Designer, then System Context"
metrics: |
  test(apps/e2e/tests/studio/views.spec.ts › back in Designer, the view shown in Viewer stays, with Designer's layout) passed
  test(apps/studio/tests/viewerSandbox.test.ts › setAppMode designer ↔ viewer › viewer → designer stays on the view viewer showed) passed
then: "Designer shows Containers with every element where Designer had it, the address names it, and the stored views are as Designer left them"
when: "the user switches to Viewer, opens Containers and runs Smart Layout there, then switches back to Designer"
---
