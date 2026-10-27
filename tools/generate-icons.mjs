#!/usr/bin/env node
// Renders every icon of radical.tools from its one mark,
// tools/brand/radical-mark.svg (ADR "One mark for radical.tools"):
//
//   apps/studio/build/icon.png            the desktop app (1024, macOS margin)
//   apps/vscode/images/icon.png           the VS Code extension (128)
//   apps/web/apple-touch-icon.png         radical.tools on a home screen (180)
//   apps/studio/src/renderer/public/apple-touch-icon.png, apps/hub/public/…
//   favicon.svg beside each of them       a copy of the mark
//   apps/studio/src/renderer/src/radical-mark.svg   the copy Studio's welcome
//                                         screen imports (a workspace imports
//                                         only its own files)
//
//   node tools/generate-icons.mjs
//
// The files are committed; tools/brand.test.mjs checks the copies match.

import { chromium } from '@playwright/test'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const MARK = join(ROOT, 'tools/brand/radical-mark.svg')

/** Where favicon.svg and apple-touch-icon.png go: what each app serves at its root. */
export const PUBLIC_DIRS = ['apps/web', 'apps/studio/src/renderer/public', 'apps/hub/public']

/** Copies of the mark beside the favicons. */
export const COPIES = [...PUBLIC_DIRS.map((dir) => `${dir}/favicon.svg`), 'apps/studio/src/renderer/src/radical-mark.svg']

/** The PNGs: path, size, and the share of it the tile fills. */
export const PNGS = [
  // macOS draws app icons on a 1024 grid with the tile at 824: the margin
  // keeps the icon the size of the others in the Dock.
  { path: 'apps/studio/build/icon.png', size: 1024, tile: 824 / 1024 },
  { path: 'apps/vscode/images/icon.png', size: 128, tile: 1 },
  ...PUBLIC_DIRS.map((dir) => ({ path: `${dir}/apple-touch-icon.png`, size: 180, tile: 1 })),
]

async function main() {
  const svg = await readFile(MARK, 'utf8')
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const browser = await chromium.launch()
  try {
    for (const { path, size, tile } of PNGS) {
      const page = await browser.newPage({ viewport: { width: size, height: size } })
      const side = Math.round(size * tile)
      await page.setContent(`<body style="margin:0;background:transparent;display:grid;place-items:center;width:${size}px;height:${size}px"><img src="${uri}" width="${side}" height="${side}"></body>`)
      await page.waitForFunction(() => document.images[0]?.complete)
      const png = await page.screenshot({ omitBackground: true })
      await mkdir(dirname(join(ROOT, path)), { recursive: true })
      await writeFile(join(ROOT, path), png)
      await page.close()
      console.log(`${path} (${size}×${size})`)
    }
  } finally {
    await browser.close()
  }
  for (const path of COPIES) {
    await mkdir(dirname(join(ROOT, path)), { recursive: true })
    await copyFile(MARK, join(ROOT, path))
    console.log(path)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
