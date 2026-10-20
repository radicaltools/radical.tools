import { describe, expect, it } from 'vitest'
import { buildInfo, compareVersions, DEV_BUILD, displayVersion, releaseOf } from '../src/version'

describe('product version', () => {
  it('shows a release bare and any other build with its commit', () => {
    expect(displayVersion({ version: '0.3.0', commit: '1a2b3c4', release: true })).toBe('0.3.0')
    expect(displayVersion({ version: '0.3.0', commit: '1a2b3c4', release: false })).toBe('0.3.0+1a2b3c4')
    expect(displayVersion({ version: '0.3.0' })).toBe('0.3.0')
    // Without a build's define, the code says it is a development build.
    expect(buildInfo()).toBe(DEV_BUILD)
  })

  it('compares versions by SemVer, two builds of one version from other commits alike', () => {
    expect(releaseOf('0.3.0+1a2b3c4')).toBe('0.3.0')
    expect(compareVersions('0.3.0+1a2b3c4', '0.3.0+9f8e7d6')).toBe(0)
    expect(compareVersions('0.2.0', '0.3.0')).toBeLessThan(0)
    expect(compareVersions('0.10.0', '0.9.1')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBeLessThan(0)
    expect(compareVersions('1.0.0-beta.1', '1.0.0-rc.1')).toBeLessThan(0)
  })
})
