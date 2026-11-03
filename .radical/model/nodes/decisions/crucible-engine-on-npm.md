---
id: "4f4e34e7-7b6c-4040-af62-ed29aaaa2124"
type: "adr"
label: "Crucible engine on npm"
alternatives: "Publish packages/crucible itself: its exports point at TypeScript sources the workspace imports directly, and pointing them at a build would make every test in the repository build first. Rename the workspace to @radicaltools/crucible: ten imports change for no gain, and every other shared package keeps the @radical scope. Keep it private and document fast-check: every project rebuilds the survey format and the replay, and the CLI options stay out of reach. Publish the first version by hand, as the MCP server was: simple, but it goes around the checks of the pipeline, and the maintainer wants every release to go through it."
consequences: "Other projects can write fuzz files, and what radical fuzz offers works for them. The engine's exports become a public API, so a change to them is a change to a published package. A release publishes a third npm package."
context: "ADR Radical Crucible settled a package of its own and that it joins the product version and the release, but only the CLI commands were published. The CLI bundles @radical/crucible, and nothing else can reach it: README said it was not published yet. A demo repository outside this one had to write its fuzz file on fast-check by hand, without known failures, survey, replay or radical harden of a finding."
date: "2026-11-03"
decision: "Publish the engine as @radicaltools/crucible from a new workspace, apps/crucible, which bundles @radical/crucible the way the CLI and the MCP server bundle their shared packages, with the entry points of the engine (., ./vitest, ./findings). fast-check stays a dependency and Vitest an optional peer. It carries the product version and goes out with a release tag, or alone through the manual run of Publish to npm. Nothing is published by hand: the first version goes through that workflow too, with a temporary repository secret NPM_TOKEN, because npm sets a trusted publisher only on a package that exists. The trusted publisher is configured after it and the secret deleted."
status: "accepted"
---
