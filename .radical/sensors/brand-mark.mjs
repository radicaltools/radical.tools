#!/usr/bin/env node
// Sensor brand-mark (.radical/sensors/sensors.json), for the fitness function One
// mark everywhere: the element's favicons and welcome mark are copies of
// tools/brand/radical-mark.svg, its icons exist at their sizes, and its
// pages link the favicon and show the mark. Run by radical sense run, once
// per element; tools/brand.test.mjs checks them all at once.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COPIES, FAVICON_LINK, LOGO, LOGO_PAGES, MARK, PAGES, PNGS, TOUCH_ICON_LINK } from '../../tools/generate-icons.mjs'
import { fail, measuredElement, sensorContext } from './context.mjs'

const ROOT = join(import.meta.dirname, '../..')
const element = measuredElement(sensorContext())
const mine = (path) => element.paths.some((f) => f === '.' || path.startsWith(`${f}/`))
const read = (path) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), 'utf8') : null)

const problems = []
const mark = readFileSync(MARK, 'utf8')
for (const path of COPIES.filter(mine)) if (read(path) !== mark) problems.push(`${path} is no copy of the mark (node tools/generate-icons.mjs)`)
for (const { path, size } of PNGS.filter((p) => mine(p.path))) {
  if (!existsSync(join(ROOT, path))) { problems.push(`${path} is missing`); continue }
  const png = readFileSync(join(ROOT, path))
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)]
  if (w !== size || h !== size) problems.push(`${path} is ${w}×${h}, not ${size}×${size}`)
}
for (const page of PAGES.filter(mine)) {
  if (!FAVICON_LINK.test(read(page) ?? '')) problems.push(`${page} does not link favicon.svg`)
  if (!TOUCH_ICON_LINK.test(read(page) ?? '')) problems.push(`${page} does not link apple-touch-icon.png`)
}
for (const page of LOGO_PAGES.filter(mine)) if (!LOGO.test(read(page) ?? '')) problems.push(`${page} does not show the mark as its logo`)
const checked = [...COPIES, ...PNGS.map((p) => p.path), ...PAGES, ...LOGO_PAGES].filter(mine).length
if (!checked) problems.push(`nothing of the mark in ${element.paths.join(', ')} (tools/generate-icons.mjs)`)
if (problems.length) fail(`${element.label}: ${problems.join('; ')}.`)
console.log(`${element.label}: the mark in ${checked} place${checked === 1 ? '' : 's'}.`)
