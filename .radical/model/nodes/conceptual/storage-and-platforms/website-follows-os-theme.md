---
id: "fd7b9dab-3d6e-4a42-8749-c927c009114c"
type: "requirement"
label: "Website follows OS theme"
action: "The website and the manual shall open in the operating system's light or dark preference, applied before the first paint."
ears_type: "state-driven"
precondition: "the visitor has not chosen a theme on radical.tools"
rationale: "The Hub opens dark in that case. Evidence: apps/web/theme.js (prefers-color-scheme), apps/web/index.html (theme.js before the stylesheets), apps/hub/src/HubApp.tsx"
---
