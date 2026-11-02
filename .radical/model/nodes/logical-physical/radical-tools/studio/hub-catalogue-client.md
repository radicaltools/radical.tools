---
id: "08e414ea-974c-4a75-8bef-9fd30d3cfaf4"
type: "component"
label: "Hub catalogue client"
technology: "Zustand, fetch (@radical/ui)"
---

packages/ui/src/store/hubStore.ts. Loads hub/index.json and <category>/<id>.radical from hub.radical.tools in production, falling back to the copy bundled at build time.
