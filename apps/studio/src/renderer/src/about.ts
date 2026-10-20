// ─── About Radical Studio ────────────────────────────────────────────────────
//
// What the About dialog (components/AboutDialog.tsx) says about this build:
// the product version, the commit and day it was built from, where Studio
// runs and the model folder format it reads and writes. The same lines are
// what Copy puts on the clipboard for a bug report.

import type { HostKind } from '@radical/host-bridge'
import { MD_FOLDER_FORMAT_VERSION } from '@radical/common/formats/mdFolder'
import { buildInfo, displayVersion, type BuildInfo } from '@radical/common/version'

export const REPOSITORY_URL = 'https://github.com/radicaltools/radical.tools'
export const CHANGELOG_URL = `${REPOSITORY_URL}/blob/main/CHANGELOG.md`

const HOST_NAMES: Record<HostKind, string> = {
  electron: 'Desktop app',
  vscode: 'VS Code extension',
  web: 'Browser',
}

export interface AboutRow {
  label: string
  value: string
  /** Where the value leads (the commit on GitHub). */
  href?: string
}

/** The rows of the About dialog for `info`, Studio running in `host`. */
export function aboutRows(host: HostKind, info: BuildInfo = buildInfo()): AboutRow[] {
  return [
    { label: 'Version', value: displayVersion(info) },
    ...(info.commit ? [{ label: 'Commit', value: info.commit, href: `${REPOSITORY_URL}/commit/${info.commit}` }] : []),
    ...(info.date ? [{ label: 'Built', value: info.date }] : []),
    { label: 'Runs as', value: HOST_NAMES[host] },
    { label: 'Model folder format', value: String(MD_FOLDER_FORMAT_VERSION) },
  ]
}

/** What Copy puts on the clipboard: one line per row, under the name. */
export function aboutText(host: HostKind, info: BuildInfo = buildInfo()): string {
  return ['Radical Studio', ...aboutRows(host, info).map((row) => `${row.label}: ${row.value}`)].join('\n')
}
