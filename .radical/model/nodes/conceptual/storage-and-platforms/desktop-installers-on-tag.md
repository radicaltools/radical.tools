---
id: "888b214e-c76f-42f3-af78-3d69dc8dbf3e"
type: "requirement"
label: "Desktop installers on tag"
action: "GitHub Actions shall refuse the tag when it differs from the version in apps/studio/package.json, and otherwise run the type-check and the tests, build unsigned installers for macOS (.dmg), Windows (.exe) and Linux (.AppImage) and draft a GitHub Release that holds them for the maintainer to publish."
ears_type: "event-driven"
rationale: "release.yml: a verify job (typecheck, npm test, tag equals v + package.json version), a build matrix on macos-latest, windows-latest and ubuntu-latest running npm run dist with CSC_IDENTITY_AUTO_DISCOVERY false, and a release job that runs gh release create --draft --generate-notes. Pull requests that touch the packaging and manual runs build the installers without a release. Evidence: .github/workflows/release.yml, apps/studio/electron-builder.yml"
trigger: "a tag v<version> is pushed"
---
