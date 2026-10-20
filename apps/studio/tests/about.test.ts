// About Radical Studio: the version, commit and day of the build, where
// Studio runs and the model folder format, as the dialog shows them and Copy
// puts them on the clipboard.
import { describe, it, expect } from 'vitest'
import { aboutRows, aboutText } from '../src/renderer/src/about'
import { buildInfo } from '@radical/common/version'
import { version } from '../package.json'

describe('About Radical Studio', () => {
  it('shows the version, the commit and day of the build, where Studio runs and the folder format', () => {
    const build = { version: '0.3.0', commit: '1a2b3c4', date: '2026-10-20', release: false }
    expect(aboutRows('web', build)).toEqual([
      { label: 'Version', value: '0.3.0+1a2b3c4' },
      { label: 'Commit', value: '1a2b3c4', href: 'https://github.com/radicaltools/radical.tools/commit/1a2b3c4' },
      { label: 'Built', value: '2026-10-20' },
      { label: 'Runs as', value: 'Browser' },
      { label: 'Model folder format', value: '1' },
    ])
    expect(aboutText('electron', { ...build, release: true })).toBe(
      'Radical Studio\nVersion: 0.3.0\nCommit: 1a2b3c4\nBuilt: 2026-10-20\nRuns as: Desktop app\nModel folder format: 1',
    )
    // The build under test carries Studio's package version.
    expect(buildInfo().version).toBe(version)
  })
})
