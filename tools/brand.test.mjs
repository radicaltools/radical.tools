// Fitness function "One mark everywhere" (ADR "One mark for radical.tools"):
// every app shows the mark from tools/brand/radical-mark.svg.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COPIES, FAVICON_LINK, LOGO, LOGO_PAGES, MARK, PAGES, PNGS, TOUCH_ICON_LINK } from './generate-icons.mjs'

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
    for (const page of PAGES) {
      expect(read(page), page).toMatch(FAVICON_LINK)
      expect(read(page), page).toMatch(TOUCH_ICON_LINK)
    }
    for (const page of LOGO_PAGES) expect(read(page), page).toMatch(LOGO)
    expect(read('apps/studio/src/renderer/src/components/WelcomeScreen.tsx')).toContain("from '../radical-mark.svg?url'")
    expect(existsSync(join(ROOT, 'tools/generate-icon.js'))).toBe(false)
  })
})
