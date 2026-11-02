---
id: "692ce224-9a23-4b9b-8aa8-31f6f817780c"
type: "requirement"
label: "One release, one version"
action: "The release script shall set that version in the CLI, the MCP server, the Desktop app and the VS Code extension and in the lockfile, move the changelog's Unreleased entries under the version and the day's date, and commit; npm run release:tag on main shall tag that commit v<version>, refusing when the four versions differ or the changelog has no section for it; and pushing the tag shall build the Desktop installers, publish the VS Code extension and publish the CLI and the MCP server to npm, each workflow failing unless all four carry the tag's version."
ears_type: "event-driven"
rationale: "Versions bumped by hand drifted apart (Studio at 1.0.0, the rest at 0.2.0), the changelog was never cut, and the npm packages were published by hand separately. The tag is made on main after the pull request is merged, since main takes changes only through pull requests."
trigger: "the maintainer runs npm run release with a version, or major, minor or patch"
---
