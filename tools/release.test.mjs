import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PRODUCT_PACKAGES, changelogSection, cutChangelog, nextVersion, productVersion, productVersions, setLockVersions, setPackageVersion, tagProblems } from './release.mjs'

const CHANGELOG = `# Changelog

## [Unreleased]

### Added
- About Radical Studio

### Fixed
- A fix

[Unreleased]: https://github.com/radicaltools/radical.tools/compare/HEAD
`

/** A repository root with the four packages at `versions` and `changelog`. */
function root(versions, changelog = CHANGELOG) {
  const dir = mkdtempSync(join(tmpdir(), 'radical-release-'))
  PRODUCT_PACKAGES.forEach((pkg, i) => {
    mkdirSync(join(dir, pkg), { recursive: true })
    writeFileSync(join(dir, pkg, 'package.json'), `{\n  "name": "p${i}",\n  "version": "${versions[i] ?? versions[0]}",\n  "dependencies": { "x": "1.0.0" }\n}\n`)
  })
  writeFileSync(join(dir, 'CHANGELOG.md'), changelog)
  return dir
}

describe('one product version', () => {
  it('the CLI, the MCP server, the Desktop app and the VS Code extension carry one version', () => {
    // The repository itself.
    const versions = productVersions()
    expect(Object.keys(versions)).toEqual(['apps/cli', 'apps/mcp', 'apps/studio', 'apps/vscode'])
    expect(new Set(Object.values(versions)).size).toBe(1)
    expect(productVersion()).toMatch(/^\d+\.\d+\.\d+/)

    const dir = root(['0.3.0', '0.3.0', '1.0.0', '0.3.0'])
    try {
      expect(() => productVersion(dir)).toThrow('apps/studio 1.0.0')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('release script', () => {
  it('sets the next version: major, minor, patch or one given that is newer', () => {
    expect(nextVersion('0.2.0', 'minor')).toBe('0.3.0')
    expect(nextVersion('0.2.0', 'patch')).toBe('0.2.1')
    expect(nextVersion('0.2.0', 'major')).toBe('1.0.0')
    expect(nextVersion('0.9.0', '1.0.0-rc.1')).toBe('1.0.0-rc.1')
    expect(nextVersion('1.0.0-rc.1', 'patch')).toBe('1.0.0')
    expect(nextVersion('1.0.0-rc.1', 'v1.0.0')).toBe('1.0.0')
    expect(() => nextVersion('0.3.0', '0.2.0')).toThrow('not newer')
    expect(() => nextVersion('0.3.0', 'next')).toThrow('Give a version')
  })

  it('moves the Unreleased entries under the version and its date, and links them', () => {
    const cut = cutChangelog(CHANGELOG, '0.3.0', '2026-10-20')
    expect(cut).toContain('## [Unreleased]\n\n## [0.3.0] - 2026-10-20\n\n### Added\n- About Radical Studio')
    expect(changelogSection(cut, 'Unreleased')).toBe('')
    expect(changelogSection(cut, '0.3.0')).toBe('### Added\n- About Radical Studio\n\n### Fixed\n- A fix')
    expect(cut).toContain('[Unreleased]: https://github.com/radicaltools/radical.tools/compare/v0.3.0...HEAD\n[0.3.0]: https://github.com/radicaltools/radical.tools/releases/tag/v0.3.0')

    // The next release compares with the one before.
    const next = cutChangelog(cut.replace('## [Unreleased]\n', '## [Unreleased]\n\n### Fixed\n- Another fix\n'), '0.3.1', '2026-11-02')
    expect(changelogSection(next, '0.3.1')).toBe('### Fixed\n- Another fix')
    expect(changelogSection(next, '0.3.0')).toBe('### Added\n- About Radical Studio\n\n### Fixed\n- A fix')
    expect(next).toContain('[0.3.1]: https://github.com/radicaltools/radical.tools/compare/v0.3.0...v0.3.1')

    // Nothing to release, or released already.
    expect(() => cutChangelog(cut, '0.3.1', '2026-11-02')).toThrow('Unreleased section of CHANGELOG.md is empty')
    expect(() => cutChangelog(CHANGELOG.replace('- A fix', '- A fix\n\n## [0.3.0] - 2026-10-20\n- old'), '0.3.0', '2026-10-20')).toThrow('already has a section')
  })

  it('changes only the version of a package.json', () => {
    const text = '{\n  "name": "x",\n  "version": "0.2.0",\n  "dependencies": { "y": "0.2.0" }\n}\n'
    expect(setPackageVersion(text, '0.3.0')).toBe('{\n  "name": "x",\n  "version": "0.3.0",\n  "dependencies": { "y": "0.2.0" }\n}\n')
  })

  it('sets the released workspaces in the lockfile, nothing else', () => {
    const lock = readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')
    const set = JSON.parse(setLockVersions(lock, '9.9.9'))
    const before = JSON.parse(lock)
    for (const dir of PRODUCT_PACKAGES) expect(set.packages[dir].version).toBe('9.9.9')
    for (const dir of PRODUCT_PACKAGES) set.packages[dir].version = before.packages[dir].version
    expect(set).toEqual(before)
  })

  it('refuses to tag when a package carries another version or the changelog has no section for it', () => {
    const ready = root(['0.3.0'], cutChangelog(CHANGELOG, '0.3.0', '2026-10-20'))
    const drifted = root(['0.3.0', '0.2.0'], cutChangelog(CHANGELOG, '0.3.0', '2026-10-20'))
    const uncut = root(['0.3.0'])
    try {
      expect(tagProblems(ready, 'v0.3.0')).toEqual([])
      expect(tagProblems(drifted, 'v0.3.0')).toEqual(['apps/mcp/package.json carries 0.2.0, not 0.3.0.'])
      expect(tagProblems(uncut, 'v0.3.0')).toEqual(['CHANGELOG.md has no section for 0.3.0.'])
      expect(tagProblems(ready, 'v0.4.0')).toHaveLength(5)
    } finally {
      for (const dir of [ready, drifted, uncut]) rmSync(dir, { recursive: true, force: true })
    }
  })
})
