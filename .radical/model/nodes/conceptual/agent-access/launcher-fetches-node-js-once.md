---
id: "de8d82ac-3d7e-4db9-ada9-0522a16e8100"
type: "scenario"
label: "Launcher fetches Node.js once"
given: "an empty folder with radical.sh, a PATH whose node is 18, and a stand-in Node.js mirror with a build and its sums"
metrics: "test(apps/cli/src/launcher.test.ts › radical.sh › finds Node.js or downloads it once, checked against its sum, and runs the CLI through npx) passed"
then: "the first run downloads the build into ~/.radical/node and runs @radicaltools/cli@latest setup --yes through its npx with the launcher's path set; the second runs without downloading; mcp runs @radicaltools/mcp@latest with the arguments after mcp; the pinned version is run unless RADICAL_VERSION names another; without a terminal or --yes nothing is downloaded and it says how; the build that does not match is not unpacked"
when: "radical.sh runs setup --yes, again with the mirror gone, then mcp, then pinned and with RADICAL_VERSION, then in another home with no terminal and no --yes, and with a build that does not match its sum"
---
