---
id: "8833743d-283a-4407-92ea-462788b37c8b"
type: "adr"
label: "Package and format versioning"
alternatives: "One lockstep version for every artifact (\"radical 1.4\"): one number to talk about, but empty releases and majors for artifacts that did not break. Start at 1.0.0 now: promises a stability the MCP tools and check.json do not have yet. Restart at 0.0.1: below the versions already on npm, and a `^0.0.x` range matches a single version. The format version equal to the apps' versions: every release would look like a format change, and a reader could not tell a compatible folder from an incompatible one. Bumping by hand with `npm version`, without Changesets: enough for one package, but with four artifacts bumps and changelog entries get forgotten. Alpha, beta and rc: the alpha/beta line is noise for one team releasing from main. Calendar versioning: says when, not whether it breaks, and pipelines that pin radical need to know the latter."
consequences: |
  A change users can see costs one small changeset file in its pull request, and the changelog is written as the work happens rather than at release time. A breaking change to an MCP tool, a CLI option or check.json shows up in review as a major (or 0.x minor) bump.
  
  Reading format N-1 needs migration code in @radical/common, and raising the format version becomes a deliberate step with its own ADR. A model saved by a newer app gives older apps a clear refusal instead of silent damage.
  
  The Desktop app's version drops to 0.x before its first release. release.yml and vscode-publish.yml change their tag triggers, and npm-publish.yml gains a dist-tag; this amends Shared npm publishing only there, its single workflow, Trusted Publishing and tarball checks stay. Changesets adds a dev dependency and a GitHub Action allowed to open pull requests.
  
  Until this is implemented, versions are bumped by hand as today, following points 2 to 6.
context: |
  radical.tools releases four versioned artifacts from one monorepo, each through its own channel: @radicaltools/cli (0.1.0 on npm) and @radicaltools/mcp (0.1.1 on npm) through npm-publish.yml, the Desktop app (1.0.0 in apps/studio/package.json, never released) through release.yml on a `v*` tag, and the VS Code extension (0.2.0) through vscode-publish.yml on a `vscode-v*` tag. The packages/ workspaces are private at 0.0.0 and bundled into each artifact. The repository has no release tags yet. Versions are bumped by hand, there is no changelog, and nothing says what counts as a breaking change.
  
  The contract users depend on most is the Markdown model folder (`radicalFormat: md-folder`, `version: 1` in radical.md). It lives in git and different versions read and write it at the same time: the CLI in CI, Studio on a laptop, the MCP server in Claude Desktop from another worktree. A newer writer can silently break an older reader. The MCP package version is also the version the server reports in the MCP handshake.
date: "2026-10-19"
decision: |
  **1. Independent versions.** Each released artifact (CLI, MCP server, Desktop app, VS Code extension) has its own version and release cadence; there is no lockstep version. The packages/ workspaces stay private at 0.0.0, bundled, never published. Studio on the web and the Hub deploy from main and carry no version.
  
  **2. SemVer against a declared public contract per artifact.**
  - CLI: commands, options, exit codes, the JSON output (`--format json`, `--evidence`) and the check.json schema. Removing or changing any of them is major; a new command or option is minor; a fix is patch.
  - MCP server: tool names, input schemas and result shapes. Removing or renaming a tool, or adding a required parameter, is major; a new tool or an optional parameter is minor.
  - Desktop app and VS Code extension: major when they write a model format older versions cannot read; minor for features, patch for fixes.
  - While an artifact is in 0.x, a minor bump may break and a patch may not.
  
  **3. The model format has its own version.** The integer `version` in radical.md is the format's version, independent of the apps' versions, and rises only for a change older readers cannot read; each rise is its own ADR. Every reader reads formats N and N-1, migrating on read, and writes N. A folder in a newer format is refused with a message naming its format and the release that reads it, never rewritten. A fixture folder in format N-1 must open in the CLI, the MCP server and Studio, checked by a fitness function.
  
  **4. Starting versions.** The CLI and the MCP server continue in 0.x from what npm holds (next 0.1.x or 0.2.0); never 0.0.x, which would sit below the published versions and which a `^0.0.x` range pins to one version. The Desktop app goes down to 0.x (for example 0.9.0) before its first release, since 1.0.0 was never released. The VS Code extension continues from 0.2.0. The format stays at 1.
  
  **5. When 1.0.0.** An artifact goes to 1.0.0 when: its public contract (MCP tools, CLI options and check.json) had no breaking change for three consecutive minor releases; reading format N-1 is checked by the fitness function; and at least one user outside this repository runs it (radical check in CI, or the MCP server). 1.0.0 is released through rc.
  
  **6. Pre-releases: beta and rc only.** `x.y.z-beta.N` is for dogfooding and volunteers and may break between betas; `x.y.z-rc.N` is a release candidate that takes fixes only. An rc comes before 1.0.0 and before every later major; 0.x minors need none. There is no alpha: 0.x and main play that role. On npm a pre-release is published with the dist-tag `next`, never `latest`, so `npx @radicaltools/mcp` and `^` ranges keep the stable version. A Desktop pre-release is a GitHub Release marked pre-release, offered by the updater only on its beta channel (`allowPrerelease`). The VS Code Marketplace accepts only major.minor.patch, so the extension publishes pre-releases with `vsce publish --pre-release` on an odd minor and releases on an even minor.
  
  **7. Changesets.** A pull request that changes a released artifact adds a `.changeset/*.md` file with the bump per artifact and one changelog sentence (or an empty changeset when users see no change); CI fails a pull request that changes an artifact's sources without one. On main the Changesets action keeps a Version packages pull request that bumps the versions and writes each artifact's CHANGELOG.md; merging it is the release decision. The Desktop app and the VS Code extension are versioned and tagged by Changesets too (`privatePackages: { version: true, tag: true }`). Pre-release series use `changeset pre enter beta|rc` and `changeset pre exit`.
  
  **8. Tags.** Release tags are `<package name>@<version>` as Changesets creates them (for example `@radicaltools/cli@0.2.0`). release.yml and vscode-publish.yml start on their own package's tags instead of `v*` and `vscode-v*`, and npm-publish.yml takes the dist-tag (`latest` or `next`) from the version.
status: "proposed"
---
