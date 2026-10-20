---
id: "8833743d-283a-4407-92ea-462788b37c8b"
type: "adr"
label: "Product and format versioning"
alternatives: "Independent versions per artifact with Changesets (this ADR's first proposal, 2026-10-19): each artifact's own SemVer and changelog and no empty releases, but four numbers to talk about, no way for a user to tell which MCP server goes with which Studio on one folder, and a tool, a bot pull request and a changeset file in every pull request. Bumping by hand with `npm version`: the versions drifted apart (Studio stood at 1.0.0 while the rest were at 0.2.0); the release script sets all four at once. Start at 1.0.0 now: promises a stability the MCP tools and check.json do not have yet. Restart at 0.0.1: below the versions already on npm, and a `^0.0.x` range matches a single version. The format version equal to the product's: every release would look like a format change, and a reader could not tell a compatible folder from an incompatible one. Alpha, beta and rc: the alpha/beta line is noise for one team releasing from main. Calendar versioning: says when, not whether it breaks, and pipelines that pin radical need to know the latter. Versions without the commit: two builds from main look alike, and a bug report cannot say which one it was."
consequences: |
  There is one number to talk about: a user, a bug report or an agent says "radical 0.3.0", and Studio can tell an MCP server of another version on the same folder. A release can carry an artifact with no change; its changelog section says what changed in which artifact.
  
  A breaking change to an MCP tool, a CLI option or check.json makes the next release a major (0.x minor) for every artifact; review checks the changelog entry says so.
  
  The changelog is written in its Unreleased section as the work happens, and cut at release time by the release script. Nothing checks yet that a pull request adds its entry.
  
  Reading format N-1 needs migration code in @radical/common, and raising the format version becomes a deliberate step with its own ADR. A model saved by a newer app gives older apps a clear refusal instead of silent damage.
  
  The Desktop app's version drops to 0.2.0 before its first release. Pushing a release tag publishes to npm and the VS Code Marketplace at once, so who may push a v* tag matters; a tag ruleset on GitHub can limit it to maintainers. vscode-publish.yml starts on the v* tag instead of vscode-v*, npm-publish.yml starts on it too and gains a dist-tag, and release.yml checks all four versions. This amends Shared npm publishing only there; its single workflow, Trusted Publishing and tarball checks stay. Builds read git at build time; a build outside a git checkout has no commit and shows the bare version.
context: |
  radical.tools releases four versioned artifacts from one monorepo, each through its own channel: @radicaltools/cli and @radicaltools/mcp (both 0.2.0 on npm) through npm-publish.yml, the Desktop app (1.0.0 in apps/studio/package.json, never released) through release.yml on a `v*` tag, and the VS Code extension (0.2.0) through vscode-publish.yml on a `vscode-v*` tag. Studio on the web deploys from main. The packages/ workspaces are private at 0.0.0 and bundled into each artifact. The repository has no release tags yet. Versions are bumped by hand and have drifted apart, the changelog has only an Unreleased section, and nothing says what counts as a breaking change. No artifact says which commit it was built from, the MCP server gives its version only in the MCP handshake, which the agent does not see, and Studio shows none.
  
  The contract users depend on most is the Markdown model folder (`radicalFormat: md-folder`, `version: 1` in radical.md). It lives in git and different builds read and write it at the same time: the CLI in CI, Studio on a laptop, the MCP server in Claude Desktop from another worktree. A newer writer can silently break an older reader, and the user cannot tell which MCP server goes with which Studio.
date: "2026-10-20"
decision: |
  **1. One product version.** The CLI, the MCP server, the Desktop app, the VS Code extension and Studio on the web carry one version, the product's. A release ships every artifact at that version, also one that did not change. The packages/ workspaces stay private at 0.0.0, bundled, never published.
  
  **2. SemVer against the public contracts of every artifact.**
  - CLI: commands, options, exit codes, the JSON output (`--format json`, `--evidence`) and the check.json schema. Removing or changing any of them is major; a new command or option is minor; a fix is patch.
  - MCP server: tool names, input schemas and result shapes. Removing or renaming a tool, or adding a required parameter, is major; a new tool or an optional parameter is minor.
  - Desktop app, VS Code extension and Studio: major when they write a model format older versions cannot read; minor for features, patch for fixes.
  - The product's version rises by the largest change in any artifact. While it is in 0.x, a minor bump may break and a patch may not.
  
  **3. The model format has its own version.** The integer `version` in radical.md is the format's version, independent of the product's, and rises only for a change older readers cannot read; each rise is its own ADR. Every reader reads formats N and N-1, migrating on read, and writes N. A folder in a newer format is refused with a message naming its format and the release that reads it, never rewritten. A fixture folder in format N-1 must open in the CLI, the MCP server and Studio, checked by a fitness function, from format 2 on.
  
  **4. Starting versions.** The product continues from 0.2.0, the version of the CLI and the MCP server on npm and of the VS Code extension; the Desktop app goes down to it from the never-released 1.0.0. The next release is 0.3.0; never 0.0.x, which would sit below the published versions. The format stays at 1.
  
  **5. When 1.0.0.** The product goes to 1.0.0 when: its public contracts (MCP tools, CLI options and check.json) had no breaking change for three consecutive minor releases; reading format N-1 is checked by the fitness function; and at least one user outside this repository runs it (radical check in CI, or the MCP server). 1.0.0 is released through rc.
  
  **6. Pre-releases: beta and rc only.** `x.y.z-beta.N` is for dogfooding and volunteers and may break between betas; `x.y.z-rc.N` is a release candidate that takes fixes only. An rc comes before 1.0.0 and before every later major; 0.x minors need none. There is no alpha: 0.x and main play that role. On npm a pre-release is published with the dist-tag `next`, never `latest`, so `npx @radicaltools/mcp` and `^` ranges keep the stable version. A Desktop pre-release is a GitHub Release marked pre-release. The VS Code Marketplace accepts only major.minor.patch, so a pre-release does not publish the extension.
  
  **7. Releasing.** `npm run release -- <version | major | minor | patch>`, on a branch, sets the version in the four artifacts' package.json files and the lockfile, moves the changelog's Unreleased entries under the version and its date, and commits. Merging that pull request is the release decision. `npm run release:tag` on main then tags the merge commit `v<version>`; it refuses when the four versions differ or the changelog has no section for the version. A test fails whenever the four versions differ.
  
  **8. One tag releases everything.** A release is tagged `v<version>`. Pushing the tag starts release.yml (the Desktop installers and a draft GitHub Release), vscode-publish.yml (the extension) and npm-publish.yml (the CLI and the MCP server, on the dist-tag `latest`, or `next` for a pre-release). Each first checks that all four artifacts carry the tag's version and the changelog has its section; npm-publish.yml also refuses a tag whose commit is not on main, and skips a package whose version npm already has, so a rerun finishes the rest. npm-publish.yml can still be run by hand for one package, a dry run by default, publishing only from main.
  
  **9. Every build names its version and commit.** Each build carries the product version, the commit and the date it was built from, taken at build time. A build that is not made from the commit tagged `v<version>` shows its version as `<version>+<commit>` (SemVer build metadata), for example Studio on the web, deployed from main. The CLI prints it with `--version`, the MCP server with `--version`, in the MCP handshake, in get_model_summary and in `.radical/agent-activity.json`, and Studio in About Radical Studio. Two builds of one version with other commits count as the same version; Studio warns when an agent writes its folder through an MCP server of another version.
status: "accepted"
---
