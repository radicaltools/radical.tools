---
id: "80ad0d61-7922-49d8-919a-0cbdd58f0092"
type: "fitness-fn"
label: "One mark everywhere"
category: "structural"
tests: "tools/brand.test.mjs"
threshold: "Passes in CI"
---

tools/brand.test.mjs: every favicon.svg (apps/web, apps/studio/src/renderer/public, apps/hub/public) is a copy of tools/brand/radical-mark.svg, the desktop, VS Code and touch icons exist at their sizes, and every page and app links the favicon.
