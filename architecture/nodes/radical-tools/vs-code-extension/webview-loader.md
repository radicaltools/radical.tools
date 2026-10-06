---
id: "8893c05a-20ad-4bc0-9003-3876600411bb"
type: "component"
label: "Webview loader"
technology: "asWebviewUri, CSP"
---

buildWebviewHtml. Loads Studio's web build (bundled webview/ or apps/studio/out/renderer), rewrites asset URLs, injects a CSP and the VS Code boot script from @radical/host-bridge; offers to build the web app when no build is found.
