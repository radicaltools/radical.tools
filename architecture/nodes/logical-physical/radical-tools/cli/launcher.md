---
id: "d77d54b5-7c84-4c51-acd3-c63696271146"
type: "component"
label: "Launcher"
technology: "POSIX sh, Windows batch"
---

apps/cli/launcher/radical.sh and radical.cmd, served at radical.tools/radical.sh and /radical.cmd (the deploy copies them into the website). Finds a Node.js 20.11 or later with npx beside it on the PATH or under ~/.radical/node (RADICAL_HOME); where there is none, downloads the latest Node.js 24 build for the platform from nodejs.org (RADICAL_NODE_MIRROR) after asking, or with --yes, checks it against SHASUMS256.txt (sha256sum or shasum; certutil on Windows) and unpacks it with tar. Then runs npx -y @radicaltools/cli@<version> with the arguments, or @radicaltools/mcp@<version> for mcp, never asking for mcp, with RADICAL_LAUNCHER set to its own path. The version line (default_version, DEFAULT_VERSION in radical.cmd) says latest until the Setup command pins it; RADICAL_VERSION overrides it for one run.
