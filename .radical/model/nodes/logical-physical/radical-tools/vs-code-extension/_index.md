---
id: "9617df9e-ab47-46c4-920c-4347b186eb0d"
type: "container"
label: "VS Code extension"
technology: "VS Code API, webview"
---

The VS Code extension (apps/vscode, vscode-radical, publisher radical-tools-oss). Opens .radical files in a custom editor and .c4.json files in a webview panel beside their text, or Studio without a file (Open app); ships Studio's web build in webview/ and talks to it through @radical/host-bridge/vscode; contributes a JSON schema for *.c4.json and *.radical. It carries the product version; vscode-publish.yml publishes it on a release tag v* (not on a pre-release tag: the Marketplace takes only major.minor.patch), after checking that the four released packages carry the tag's version.
