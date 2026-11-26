---
id: "c7ed708c-9b95-42b1-90f9-4d42ad67c627"
type: "requirement"
label: "Only tested builds deploy"
action: "GitHub Actions shall run the E2E suite, the workspace boundary check, the type-check and the unit tests, unless the commit's tree passed them in a run of the pull-request checks that marked it as checked, and only when all pass, or passed there, publish Studio to studio.radical.tools, the Hub and its catalogue to hub.radical.tools and the website to radical.tools, serving each site's HTML entry point uncached so that the next page load gets the new build."
ears_type: "event-driven"
rationale: "deploy.yml asks first whether its tree is marked as checked (job known, tools/ci/checked.mjs: an artifact named after the tree's hash, kept by a successful run of ci.yml of this repository); for a tree with no mark its deploy job needs the reusable e2e.yml job and runs check:workspaces, typecheck and npm test before building, and for a marked one it builds at once (ADR A tree checked once is not checked again). Vite assets are content-hashed and cached for a year (immutable); index.html, the Hub catalogue and the website's HTML are uploaded no-store, the website's CSS and script URLs are stamped with the commit id, and CloudFront is invalidated for the entry points. Evidence: .github/workflows/deploy.yml, .github/workflows/ci.yml (job ci), .github/workflows/e2e.yml, tools/ci/checked.mjs, infra/main.tf, infra/hub.tf, infra/web.tf"
trigger: "a commit lands on main"
---
