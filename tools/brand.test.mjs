// Fitness function "One mark everywhere" (ADR "One mark for radical.tools"):
// every app shows the mark from tools/brand/radical-mark.svg.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COPIES, MARK, PNGS } from './generate-icons.mjs'

const ROOT = join(import.meta.dirname, '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8')

/** Width and height of a PNG, from its IHDR chunk. */
function pngSize(path) {
  const png = readFileSync(join(ROOT, path))
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

describe('one mark everywhere', () => {
  it('copies the mark as each app\'s favicon and Studio\'s welcome mark, and renders every icon at its size', () => {
    const mark = readFileSync(MARK, 'utf8')
    for (const path of COPIES) expect(read(path), `${path}: node tools/generate-icons.mjs`).toBe(mark)
    for (const { path, size } of PNGS) expect(pngSize(path), path).toEqual([size, size])
  })

  it('links the favicon from every page and shows the mark as the logo', () => {
    for (const page of ['apps/web/index.html', 'apps/web/usecases.html', 'apps/web/manual.html', 'apps/web/reference.html', 'apps/studio/src/renderer/index.html', 'apps/hub/index.html']) {
      expect(read(page), page).toMatch(/<link rel="icon" href="(\.\/)?favicon\.svg" type="image\/svg\+xml" \/>/)
      expect(read(page), page).toMatch(/<link rel="apple-touch-icon" href="(\.\/)?apple-touch-icon\.png" \/>/)
    }
    for (const page of ['apps/web/index.html', 'apps/web/usecases.html', 'apps/web/manual.html', 'apps/web/reference.html', 'apps/hub/src/SiteNav.tsx']) {
      expect(read(page), page).toMatch(/<img class(Name)?="site-nav-mark" src="(\.\/)?favicon\.svg"/)
    }
    expect(read('apps/studio/src/renderer/src/components/WelcomeScreen.tsx')).toContain("from '../radical-mark.svg?url'")
    expect(existsSync(join(ROOT, 'tools/generate-icon.js'))).toBe(false)
  })
})
