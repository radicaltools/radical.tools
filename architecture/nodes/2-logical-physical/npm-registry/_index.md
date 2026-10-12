---
id: "c20893c8-b656-41b9-aac3-3fb9e6e3469c"
type: "system"
label: "npm registry"
external: true
---

Distributes @radicaltools/mcp publicly under the radicaltools npm organization. Users run its radical-mcp executable through npx without cloning the monorepo. After the first interactive release under this scope, configure the new package to trust the radicaltools/radical.tools GitHub Actions workflow mcp-publish.yml through OIDC; no npm publish token is stored in the repository. Existing @radical.tools/mcp releases remain a separate package identity.
