---
id: "32793ee9-a939-498b-a71e-77831ce7ef4c"
type: "component"
label: "App shell and routing"
technology: "React 18, html-to-image"
---

apps/studio/src/renderer/src: App.tsx, route.ts, Toolbar (Radical menu, perspective switch, theme, and at its right end, in every perspective, Changes on branch), Welcome screen, Quick Search, selection and edge action bars, PNG/SVG export and copy to clipboard (hooks/useExport.ts), components/BranchChanges.tsx (the Changes on branch toggle: a small button with an icon and the number of changed elements, marked when the base is old, its name and what the count is about in a tooltip on hover, and, without a base, the commands that save one). Keeps the hash route (#/d/<doc>/m/<mode>/v/<view>/…) in step with the open document and view.
