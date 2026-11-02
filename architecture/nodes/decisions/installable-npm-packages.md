---
id: "3015c7f5-e82a-4a9a-b0fb-b9990a5ef6eb"
type: "fitness-fn"
label: "Installable npm packages"
cadence: "triggered"
characteristic: "flexibility"
invocation: "automated"
measure: "npm-package"
metrics: "npm-package.exit_code == 0"
scope: "holistic"
trigger: "pull-request"
---

Measured for each element the npm publishing ADRs constrain (the CLI and the MCP server): radical sense run runs the repository's sensor npm-package (radical.sensors.json, tools/sensors/npm-package.mjs) once per element, which runs npm run test:package of the element's workspace (apps/cli, apps/mcp). Each scripts/test-package.mjs runs npm pack and checks the archive: it holds dist/index.js, README.md and LICENSE, nothing outside dist/ but those, and no @radical/* runtime dependency (the MCP server's also the bundled Hub catalogue). It installs the archive with production dependencies only into a temporary project outside the monorepo, checks the executable (shebang, bin) and the MIT license, and runs it: the MCP server answers the MCP handshake with the package version and its tools succeed over stdio, the CLI runs its commands on a model. ci.yml also runs the MCP server's on Linux and Windows with Node 20 and 24; npm-publish.yml runs it again before it publishes the archive it verified.

Threshold: npm run test:package passes for each published package on every pull request, and in the publish run before npm publish.
