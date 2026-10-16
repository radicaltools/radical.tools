---
id: "32793ee9-a939-498b-a71e-77831ce7ef4c"
type: "component"
label: "App shell and routing"
technology: "React 18, html-to-image"
---

apps/studio/src/renderer/src: App.tsx, route.ts, Toolbar (Radical menu, perspective switch, theme, Changes on branch), Welcome screen, Quick Search, selection and edge action bars, PNG/SVG export and copy to clipboard (hooks/useExport.ts), components/BranchChanges.tsx (the Changes on branch button with its count and, without a base, the commands that save one; the chip over the view with the base, its age and the counts, marked when the base is old, and its List: every element added, changed with its changed fields, and removed, and the relations, each element still in the model a link to it on a canvas). Keeps the hash route (#/d/<doc>/m/<mode>/v/<view>/…) in step with the open document and view.
