---
id: "32793ee9-a939-498b-a71e-77831ce7ef4c"
type: "component"
label: "App shell and routing"
technology: "React 18, html-to-image"
---

apps/studio/src/renderer/src: App.tsx, route.ts (the route names the place on screen in one form: document, perspective, view, Inspector tab, selected element or the Inspector's open card, wiki page, milestone, slide; a change of place pushes it onto the window's history, applying one replaces), navHistory.ts (the routes pushed, with labels and times, for the toolbar), Toolbar (Radical menu, ending with About Radical Studio: components/AboutDialog.tsx and about.ts show the version, commit and day of the build, where Studio runs and the model folder format, with Copy and a link to the changelog; then in every perspective Back, Forward and History, components/NavHistory.tsx, with Alt+← / Alt+→, ⌘[ / ⌘] and the desktop app's mouse side buttons; then Changes on branch in every perspective but the Inspector; then Undo and Redo; perspective switch, theme), Welcome screen, Quick Search, selection and edge action bars, PNG/SVG export and copy to clipboard (hooks/useExport.ts), components/BranchChanges.tsx (the Changes on branch toggle: a small button with an icon and the number of changed elements, marked when the base is old, its name and what the count is about in a tooltip on hover, and, without a base, the commands that save one). Keeps the hash route (#/d/<doc>/m/<mode>/v/<view>/…) in step with the open document and view.
