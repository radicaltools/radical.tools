---
id: "76f6dad3-9f4d-4942-b9e4-4b6cb46b14fd"
type: "component"
label: "Layout runners"
technology: "Web Worker (@radical/ui)"
---

packages/ui/src/layout: the browser side of the layout engines. Smart Layout ranks and anneals in a Web Worker (smartLayout.worker.ts, smartLayoutRunner.ts); the live WebCoLa physics runs in another (liveCola.worker.ts, liveColaLayout.ts), or on the main thread where workers are not available. The engines themselves are in @radical/layout.
